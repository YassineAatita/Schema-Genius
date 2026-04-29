<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Notification;
use App\Models\Project;
use App\Models\ProjectCollaborator;
use App\Models\ProjectFork;
use App\Models\Schema;
use App\Models\SchemaVersion;
use App\Services\NotificationMailer;
use Illuminate\Http\Request;

class ForkController extends Controller
{
    // POST /api/projects/{id}/fork
    // Creates a new private project for the auth user with the schema copied.
    public function store(Request $request, $id)
    {
        $original = Project::where('visibility', 'public')
            ->with('schema.currentVersion')
            ->findOrFail($id);

        $user = $request->user();

        if ($original->owner_id === $user->id) {
            return response()->json(['error' => 'You cannot fork your own project.'], 403);
        }

        // BUG 3 FIX — collaborators already have full access; forking would be redundant
        $isCollaborator = ProjectCollaborator::where('project_id', $original->id)
            ->where('user_id', $user->id)
            ->where('status', 'accepted')
            ->exists();
        if ($isCollaborator) {
            return response()->json(['error' => 'You are already a collaborator on this project. Collaborators cannot fork a project they already have access to.'], 403);
        }

        // One fork per user per original project
        $alreadyForked = ProjectFork::where('user_id', $user->id)
                                    ->where('original_project_id', $original->id)
                                    ->exists();
        if ($alreadyForked) {
            return response()->json(['error' => 'You have already forked this project.'], 409);
        }

        // Create the new project (forks start private)
        $forked = Project::create([
            'owner_id'    => $user->id,
            'name'        => $original->name . ' (fork)',
            'description' => $original->description,
            'visibility'  => 'private',
        ]);

        // Create schema for the forked project
        $forkedSchema = Schema::create([
            'project_id' => $forked->id,
            'name'       => 'Main Schema',
        ]);

        // Copy the current version's schema_json if it exists
        if ($original->schema?->currentVersion) {
            $version = SchemaVersion::create([
                'schema_id'      => $forkedSchema->id,
                'version_number' => 1,
                'label'          => mb_substr("Forked from {$original->name}", 0, 100),
                'schema_json'    => $original->schema->currentVersion->schema_json,
                'created_by'     => $user->id,
                'created_at'     => now(),
            ]);
            $forkedSchema->update(['current_version_id' => $version->id]);
        }

        // Record the fork relationship (Schema DNA)
        ProjectFork::create([
            'original_project_id' => $original->id,
            'forked_project_id'   => $forked->id,
            'user_id'             => $user->id,
        ]);

        // BUG 3 FIX — straight ASCII quotes, wrapped in try/catch so a notification
        // failure never causes a 500 and rolls back the successfully created fork.
        try {
            Notification::create([
                'user_id' => $original->owner_id,
                'type'    => 'project_forked',
                'title'   => 'Someone forked your schema',
                'message' => "{$user->name} forked \"{$original->name}\" into their workspace.",
                'data'    => [
                    'project_id'        => $original->id,
                    'forked_project_id' => $forked->id,
                    'actor_id'          => $user->id,
                    'actor_name'        => $user->name,
                ],
            ]);
        } catch (\Throwable $e) {
            // Notification failure must not fail the fork action
        }

        NotificationMailer::send($original->owner_id, 'project_forked', [
            'actor_name'   => $user->name,
            'project_name' => $original->name,
            'project_id'   => $original->id,
        ]);

        return response()->json([
            'message' => 'Project forked successfully.',
            'project' => array_merge($forked->load('schema')->toArray(), ['is_owner' => true]),
        ], 201);
    }

    // GET /api/projects/{id}/forks — Direct forks of a project
    public function index($id)
    {
        $project = Project::where('visibility', 'public')->findOrFail($id);

        $forks = ProjectFork::where('original_project_id', $project->id)
            ->with(['forkedProject.owner', 'user'])
            ->latest()
            ->get()
            ->map(fn ($f) => [
                'id'         => $f->forkedProject?->id,
                'name'       => $f->forkedProject?->name,
                'visibility' => $f->forkedProject?->visibility,
                'forked_by'  => [
                    'id'         => $f->user->id,
                    'name'       => $f->user->name,
                    'avatar_url' => $f->user->avatar_url,
                ],
                'forked_at'  => $f->created_at,
            ]);

        return response()->json(['forks' => $forks, 'total' => $forks->count()]);
    }

    // GET /api/projects/{id}/fork-tree — Full Schema DNA ancestry tree
    // Returns the root ancestor + all fork descendants as a flat list,
    // so the frontend can render the tree however it wants.
    // Only traverses and exposes PUBLIC projects; private forks are hidden.
    public function tree($id)
    {
        // Only allow the tree to be requested for public projects.
        // This prevents an attacker from discovering private project names/owners
        // that appear in the fork lineage of a public schema.
        $project = Project::where('visibility', 'public')->findOrFail($id);

        // Walk up to find the root (cycle-safe — visited set prevents infinite loops)
        $rootId      = $this->findRoot($project->id);
        $rootProject = Project::with('owner')->find($rootId);

        // Walk down to collect all public descendants
        $descendants = $this->collectDescendants($rootId);

        return response()->json([
            'root'        => [
                'id'    => $rootProject->id,
                'name'  => $rootProject->name,
                'owner' => $rootProject->owner?->name,
            ],
            'current_id'  => $project->id,
            'descendants' => $descendants,
        ]);
    }

    /**
     * Walk up the fork chain to find the original ancestor.
     * Uses a visited set to prevent infinite loops on circular references.
     */
    private function findRoot(int $projectId, array $visited = []): int
    {
        if (in_array($projectId, $visited)) {
            // Circular reference detected — stop and treat current node as root
            return $projectId;
        }
        $visited[]  = $projectId;
        $forkRecord = ProjectFork::where('forked_project_id', $projectId)->first();
        if (!$forkRecord) return $projectId; // already the root
        return $this->findRoot($forkRecord->original_project_id, $visited);
    }

    /**
     * Recursively collect all fork descendants.
     * Only includes PUBLIC projects to avoid leaking private project names/owners.
     * Depth is capped at 10 to prevent runaway queries.
     */
    private function collectDescendants(int $projectId, int $depth = 0, array $visited = []): array
    {
        if (in_array($projectId, $visited)) return [];
        $visited[] = $projectId;

        $forks = ProjectFork::where('original_project_id', $projectId)
            ->with(['forkedProject.owner', 'user'])
            ->get();

        $result = [];
        foreach ($forks as $fork) {
            if (!$fork->forkedProject) continue;
            // Skip private forks — do not expose their names or owners
            if ($fork->forkedProject->visibility !== 'public') continue;

            $node = [
                'id'          => $fork->forkedProject->id,
                'name'        => $fork->forkedProject->name,
                'owner'       => $fork->forkedProject->owner?->name,
                'forked_by'   => $fork->user->name,
                'forked_at'   => $fork->created_at,
                'depth'       => $depth + 1,
                'parent_id'   => $projectId,
            ];
            $result[] = $node;
            // Recursively collect children (cap depth at 10 to prevent runaway queries)
            if ($depth < 10) {
                $result = array_merge(
                    $result,
                    $this->collectDescendants($fork->forkedProject->id, $depth + 1, $visited)
                );
            }
        }
        return $result;
    }
}

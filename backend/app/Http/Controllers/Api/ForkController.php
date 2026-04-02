<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Notification;
use App\Models\Project;
use App\Models\ProjectFork;
use App\Models\Schema;
use App\Models\SchemaVersion;
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
                'label'          => "Forked from {$original->name}",
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

        // Notify the original project owner
        Notification::create([
            'user_id' => $original->owner_id,
            'type'    => 'project_forked',
            'title'   => 'Someone forked your schema',
            'message' => "{$user->name} forked "{$original->name}" into their workspace.",
            'data'    => [
                'project_id'        => $original->id,
                'forked_project_id' => $forked->id,
                'actor_id'          => $user->id,
                'actor_name'        => $user->name,
            ],
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
    public function tree($id)
    {
        $project = Project::findOrFail($id);

        // Walk up to find the root
        $rootId    = $this->findRoot($project->id);
        $rootProject = Project::with('owner')->find($rootId);

        // Walk down to collect all descendants (BFS)
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

    private function findRoot(int $projectId): int
    {
        $forkRecord = ProjectFork::where('forked_project_id', $projectId)->first();
        if (!$forkRecord) return $projectId; // already the root
        return $this->findRoot($forkRecord->original_project_id);
    }

    private function collectDescendants(int $projectId, int $depth = 0): array
    {
        $forks = ProjectFork::where('original_project_id', $projectId)
            ->with(['forkedProject.owner', 'user'])
            ->get();

        $result = [];
        foreach ($forks as $fork) {
            if (!$fork->forkedProject) continue;
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
                $result = array_merge($result, $this->collectDescendants($fork->forkedProject->id, $depth + 1));
            }
        }
        return $result;
    }
}

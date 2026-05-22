<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Project;
use App\Models\Schema;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class ProjectController extends Controller
{
    // GET /api/projects
    // Returns all projects owned by or shared with the logged-in user
    public function index(Request $request)
    {
        $user = $request->user();

        // Helper: extract up to 8 node names from the current schema version.
        // Strips the heavy schema_json from the serialised response so the payload
        // stays lean — only the compact thumbnail_nodes array is sent to the client.
        $extractThumbnail = function ($p): array {
            $schemaJson = $p->schema?->currentVersion?->schema_json;
            $thumbnailNodes = [];
            if (is_array($schemaJson) && !empty($schemaJson['nodes'])) {
                $rawNodes = array_slice($schemaJson['nodes'], 0, 8);
                $thumbnailNodes = array_values(array_map(
                    fn ($n) => $n['data']['name'] ?? 'table',
                    $rawNodes
                ));
            }
            // Prevent schema_json from appearing in the JSON response
            if ($p->schema?->currentVersion) {
                $p->schema->currentVersion->makeHidden(['schema_json']);
            }
            return $thumbnailNodes;
        };

        // Projects I own
        $ownedProjects = Project::where('owner_id', $user->id)
            ->withCount('collaborators')
            ->with('schema.currentVersion')
            ->latest()
            ->get()
            ->map(function ($p) use ($extractThumbnail) {
                return array_merge($p->toArray(), [
                    'is_owner'        => true,
                    'thumbnail_nodes' => $extractThumbnail($p),
                ]);
            });

        // Projects I was invited to (accepted only)
        $sharedProjects = $user->collaboratingProjects()
            ->wherePivot('status', 'accepted')
            ->withCount('collaborators')
            ->with('schema.currentVersion')
            ->latest()
            ->get()
            ->map(function ($p) use ($extractThumbnail) {
                return array_merge($p->toArray(), [
                    'is_owner'        => false,
                    'my_role'         => $p->pivot->role,
                    'thumbnail_nodes' => $extractThumbnail($p),
                ]);
            });

        // Merge both lists
        $allProjects = $ownedProjects->concat($sharedProjects)
            ->sortByDesc('created_at')
            ->values();

        return response()->json($allProjects);
    }

    // POST /api/projects
    // Create a new project and automatically create its schema
    public function store(Request $request)
    {
        $validated = $request->validate([
            'name'        => 'required|string|max:255',
            'description' => 'nullable|string|max:1000',
            'visibility'  => 'in:private,public',
        ]);

        $project = Project::create([
            'owner_id'    => $request->user()->id,
            'name'        => $validated['name'],
            'description' => $validated['description'] ?? null,
            'visibility'  => $validated['visibility'] ?? 'private',
        ]);

        // Every project automatically gets one schema
        Schema::create([
            'project_id' => $project->id,
            'name'       => 'Main Schema',
        ]);

        return response()->json(
            array_merge($project->load('schema')->toArray(), ['is_owner' => true]),
            201
        );
    }

    // GET /api/projects/{id}
    // Get a single project with its schema and collaborators
    public function show(Request $request, $id)
    {
        $project = Project::with(['schema.currentVersion', 'collaborators', 'owner'])
            ->findOrFail($id);

        // Only owner or collaborator can view
        $this->authorizeAccess($request->user(), $project);

        return response()->json($project);
    }

    // PUT /api/projects/{id}
    // Update project name or description
    public function update(Request $request, $id)
    {
        $project = Project::findOrFail($id);

        // Only owner can edit
        if ($project->owner_id !== $request->user()->id) {
            return response()->json(['message' => 'Only the owner can edit this project.'], 403);
        }

        $validated = $request->validate([
            'name'        => 'sometimes|string|max:255',
            'description' => 'nullable|string|max:1000',
            'visibility'  => 'sometimes|in:private,public',
        ]);

        $project->update($validated);

        return response()->json($project);
    }

    // DELETE /api/projects/{id}
    // Soft delete the project
    public function destroy(Request $request, $id)
    {
        $project = Project::findOrFail($id);

        // Only owner can delete
        if ($project->owner_id !== $request->user()->id) {
            return response()->json(['message' => 'Only the owner can delete this project.'], 403);
        }

        $project->delete();

        return response()->json(['message' => 'Project deleted successfully.']);
    }

    // POST /api/projects/{id}/active
    // Called by DesignerPage on mount to mark user as currently designing.
    // Stores a timestamp in a per-project cache map so activeCounts() can
    // return fresh numbers without Reverb presence-channel membership.
    public function markActive(Request $request, $id)
    {
        $userId = $request->user()->id;
        $key    = "project_active_{$id}";
        $map    = Cache::get($key, []);
        $map[$userId] = time();
        Cache::put($key, $map, 300); // 5-min safety TTL (heartbeat refreshes it)
        return response()->json(['ok' => true]);
    }

    // DELETE /api/projects/{id}/active
    // Called by DesignerPage on unmount to immediately clear the user's entry.
    public function markInactive(Request $request, $id)
    {
        $userId = $request->user()->id;
        $key    = "project_active_{$id}";
        $map    = Cache::get($key, []);
        unset($map[$userId]);
        empty($map) ? Cache::forget($key) : Cache::put($key, $map, 300);
        return response()->json(['ok' => true]);
    }

    // GET /api/projects/active-counts
    // Returns { projectId: count } for all projects the user can access,
    // counting only OTHER users who have been active in the last 3 minutes.
    public function activeCounts(Request $request)
    {
        $user   = $request->user();
        $now    = time();
        $counts = [];

        $ownedIds  = Project::where('owner_id', $user->id)->pluck('id');
        $collabIds = DB::table('project_collaborators')
            ->where('user_id', $user->id)
            ->where('status', 'accepted')
            ->pluck('project_id');

        foreach ($ownedIds->concat($collabIds)->unique() as $pid) {
            $key = "project_active_{$pid}";
            $map = Cache::get($key, []);

            // Remove stale entries (older than 3 minutes)
            $live = array_filter($map, fn($ts) => ($now - $ts) < 180);

            // If the requesting user still has an entry, they are on the dashboard
            // now (not in the designer). Remove their entry from cache immediately
            // so the badge doesn't linger even if the async DELETE from DesignerPage
            // hasn't completed yet.
            if (isset($live[$user->id])) {
                unset($live[$user->id]);
                empty($live) ? Cache::forget($key) : Cache::put($key, $live, 300);
            } elseif (count($live) !== count($map)) {
                // Stale entries were pruned — write the cleaned map back to cache
                empty($live) ? Cache::forget($key) : Cache::put($key, $live, 300);
            }

            $counts[(string) $pid] = count($live);
        }

        return response()->json($counts);
    }

    // Helper — check if user has access to a project
    private function authorizeAccess($user, $project)
    {
        $isOwner = $project->owner_id === $user->id;
        $isCollaborator = $project->collaborators
            ->filter(fn($c) => $c->pivot->status === 'accepted')
            ->contains('id', $user->id);

        if (!$isOwner && !$isCollaborator) {
            abort(403, 'You do not have access to this project.');
        }
    }
}
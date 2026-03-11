<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Project;
use App\Models\Schema;
use Illuminate\Http\Request;

class ProjectController extends Controller
{
    // GET /api/projects
    // Returns all projects owned by or shared with the logged-in user
    public function index(Request $request)
    {
        $user = $request->user();

        // Projects I own
        $ownedProjects = Project::where('owner_id', $user->id)
            ->withCount('collaborators')
            ->with('schema')
            ->latest()
            ->get()
            ->map(fn($p) => array_merge($p->toArray(), ['is_owner' => true]));

        // Projects I was invited to (accepted only)
        $sharedProjects = $user->collaboratingProjects()
            ->wherePivot('status', 'accepted')
            ->withCount('collaborators')
            ->with('schema')
            ->latest()
            ->get()
            ->map(fn($p) => array_merge(
                $p->toArray(),
                [
                    'is_owner'      => false,
                    'my_role'       => $p->pivot->role,
                ]
            ));

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
            $project->load('schema'),
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
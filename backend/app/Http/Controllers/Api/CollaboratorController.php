<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Project;
use App\Models\User;
use Illuminate\Http\Request;

class CollaboratorController extends Controller
{
    // GET /api/projects/{id}/collaborators
    public function index(Request $request, $projectId)
    {
        $project = Project::with('collaborators')->findOrFail($projectId);
        $this->ownerOnly($request->user(), $project);

        return response()->json(
            $project->collaborators->map(fn($c) => [
                'id'     => $c->id,
                'name'   => $c->name,
                'email'  => $c->email,
                'role'   => $c->pivot->role,
                'status' => $c->pivot->status,
            ])
        );
    }

    // POST /api/projects/{id}/collaborators
    public function store(Request $request, $projectId)
    {
        $project = Project::findOrFail($projectId);
        $this->ownerOnly($request->user(), $project);

        $request->validate([
            'email' => 'required|email|exists:users,email',
            'role'  => 'required|in:editor,viewer',
        ]);

        $invitee = User::where('email', $request->email)->first();

        if ($invitee->id === $request->user()->id) {
            return response()->json(['message' => 'You cannot invite yourself.'], 422);
        }

        if ($project->collaborators()->where('user_id', $invitee->id)->exists()) {
            return response()->json(['message' => 'This user is already a collaborator.'], 422);
        }

        $project->collaborators()->attach($invitee->id, [
            'role'       => $request->role,
            'status'     => 'pending',
            'invited_at' => now(),
        ]);

        return response()->json([
            'id'     => $invitee->id,
            'name'   => $invitee->name,
            'email'  => $invitee->email,
            'role'   => $request->role,
            'status' => 'pending',
        ], 201);
    }

    // PUT /api/projects/{id}/collaborators/{userId}
    public function update(Request $request, $projectId, $userId)
    {
        $project = Project::findOrFail($projectId);
        $this->ownerOnly($request->user(), $project);

        $request->validate(['role' => 'required|in:editor,viewer']);

        $project->collaborators()->updateExistingPivot($userId, ['role' => $request->role]);

        return response()->json(['message' => 'Role updated.']);
    }

    // DELETE /api/projects/{id}/collaborators/{userId}
    public function destroy(Request $request, $projectId, $userId)
    {
        $project = Project::findOrFail($projectId);
        $this->ownerOnly($request->user(), $project);

        $project->collaborators()->detach($userId);

        return response()->json(['message' => 'Collaborator removed.']);
    }

    private function ownerOnly($user, $project)
    {
        if ($project->owner_id !== $user->id) {
            abort(403, 'Only the project owner can manage collaborators.');
        }
    }
}

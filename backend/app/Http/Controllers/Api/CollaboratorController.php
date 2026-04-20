<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Notification;
use App\Models\Project;
use App\Models\User;
use App\Services\NotificationMailer;
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
    // Accepts { email, role } OR { user_id, role }
    public function store(Request $request, $projectId)
    {
        $project = Project::findOrFail($projectId);
        $this->ownerOnly($request->user(), $project);

        $request->validate([
            'role'    => 'required|in:editor,viewer',
            'email'   => 'required_without:user_id|nullable|email|exists:users,email',
            'user_id' => 'required_without:email|nullable|integer|exists:users,id',
        ]);

        $invitee = $request->filled('user_id')
            ? User::findOrFail($request->user_id)
            : User::where('email', $request->email)->firstOrFail();

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

        // Notify the invitee about the collaboration invitation
        try {
            Notification::create([
                'user_id' => $invitee->id,
                'type'    => 'collaboration_invited',
                'title'   => 'Collaboration invitation',
                'message' => "{$request->user()->name} invited you to collaborate on \"{$project->name}\".",
                'data'    => [
                    'project_id'   => $project->id,
                    'project_name' => $project->name,
                    'actor_id'     => $request->user()->id,
                    'actor_name'   => $request->user()->name,
                    'role'         => $request->role,
                ],
            ]);
        } catch (\Throwable $e) {
            // Notification failure must not fail the invitation
        }

        NotificationMailer::send($invitee->id, 'collaboration_invited', [
            'actor_name'   => $request->user()->name,
            'project_name' => $project->name,
            'project_id'   => $project->id,
            'role'         => $request->role,
        ]);

        return response()->json([
            'id'        => $invitee->id,
            'name'      => $invitee->name,
            'email'     => $invitee->email,
            'avatar_url'=> $invitee->avatar_url,
            'role'      => $request->role,
            'status'    => 'pending',
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

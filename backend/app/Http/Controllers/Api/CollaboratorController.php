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
            $project->collaborators->map(function ($c) use ($project) {
                // For pending records, distinguish owner-sent invitations from
                // visitor-initiated access requests via the notification log.
                $source = 'invitation';
                if ($c->pivot->status === 'pending') {
                    $isRequest = Notification::where('type', 'access_requested')
                        ->where('user_id', $project->owner_id)
                        ->whereJsonContains('data->actor_id', (int) $c->id)
                        ->whereJsonContains('data->project_id', (int) $project->id)
                        ->exists();
                    if ($isRequest) $source = 'request';
                }
                return [
                    'id'         => $c->id,
                    'name'       => $c->name,
                    'email'      => $c->email,
                    'avatar_url' => $c->avatar_url,
                    'role'       => $c->pivot->role,
                    'status'     => $c->pivot->status,
                    'source'     => $source,   // 'invitation' | 'request'
                ];
            })
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

    // GET /api/projects/{id}/my-access
    // Returns the current authenticated user's collaborator status on this project.
    // Callable by any authenticated user (not owner-only).
    public function myAccess(Request $request, $projectId)
    {
        $project = Project::findOrFail($projectId);
        $user    = $request->user();

        // Owner always has full access
        if ($project->owner_id === $user->id) {
            return response()->json(['status' => 'owner']);
        }

        $collab = $project->collaborators()
            ->where('users.id', $user->id)
            ->first();

        if (!$collab) {
            return response()->json(['status' => 'none']);
        }

        // Return status + role (pending|accepted, editor|viewer)
        return response()->json([
            'status' => $collab->pivot->status,   // 'pending' | 'accepted'
            'role'   => $collab->pivot->role,      // 'editor'  | 'viewer'
        ]);
    }

    // POST /api/projects/{id}/request-access
    // Lets any authenticated user request editor access to a public project.
    // Creates a pending collaborator record and notifies the project owner.
    public function requestAccess(Request $request, $projectId)
    {
        $project   = Project::findOrFail($projectId);
        $requester = $request->user();

        // Owner can't request access to their own project
        if ($project->owner_id === $requester->id) {
            return response()->json(['error' => 'You own this project.'], 422);
        }

        // Already a collaborator?
        $existing = $project->collaborators()
            ->where('users.id', $requester->id)
            ->first();

        if ($existing) {
            return response()->json([
                'error'  => 'You already have access.',
                'status' => $existing->pivot->status,
                'role'   => $existing->pivot->role,
            ], 422);
        }

        // Add as a pending editor
        $project->collaborators()->attach($requester->id, [
            'role'       => 'editor',
            'status'     => 'pending',
            'invited_at' => now(),
        ]);

        // Notify the project owner via the standard notification model
        $owner = $project->owner;
        try {
            Notification::create([
                'user_id' => $owner->id,
                'type'    => 'access_requested',
                'title'   => 'Editor access requested',
                'message' => "{$requester->name} is requesting editor access to \"{$project->name}\".",
                'data'    => [
                    'project_id'   => $project->id,
                    'project_name' => $project->name,
                    'actor_id'     => $requester->id,
                    'actor_name'   => $requester->name,
                    'role'         => 'editor',
                ],
            ]);
        } catch (\Throwable $e) {
            // Notification failure must not abort the request
        }

        return response()->json(['message' => 'Access request sent. The owner has been notified.']);
    }

    // POST /api/projects/{id}/access-requests/{userId}/approve
    // Owner approves a pending access request — sets status to accepted, notifies requester.
    public function approveRequest(Request $request, $projectId, $userId)
    {
        $project   = Project::findOrFail($projectId);
        $requester = User::findOrFail($userId);
        $this->ownerOnly($request->user(), $project);

        $collab = $project->collaborators()
            ->where('users.id', $requester->id)
            ->wherePivot('status', 'pending')
            ->first();

        if (!$collab) {
            return response()->json(['message' => 'No pending request found.'], 404);
        }

        $project->collaborators()->updateExistingPivot($requester->id, ['status' => 'accepted']);

        // Notify the requester
        try {
            Notification::create([
                'user_id' => $requester->id,
                'type'    => 'access_request_approved',
                'title'   => 'Access request approved',
                'message' => "{$request->user()->name} approved your request to edit \"{$project->name}\".",
                'data'    => [
                    'project_id'   => $project->id,
                    'project_name' => $project->name,
                    'actor_id'     => $request->user()->id,
                    'actor_name'   => $request->user()->name,
                ],
            ]);
        } catch (\Throwable $e) {}

        // Remove the access_requested notification so the bell clears automatically
        Notification::where('user_id', $project->owner_id)
            ->where('type', 'access_requested')
            ->whereJsonContains('data->actor_id', (int) $requester->id)
            ->whereJsonContains('data->project_id', (int) $project->id)
            ->delete();

        return response()->json(['message' => 'Request approved. The user now has editor access.']);
    }

    // POST /api/projects/{id}/access-requests/{userId}/decline
    // Owner declines a pending access request — removes the pivot record, notifies requester.
    public function declineRequest(Request $request, $projectId, $userId)
    {
        $project   = Project::findOrFail($projectId);
        $requester = User::findOrFail($userId);
        $this->ownerOnly($request->user(), $project);

        $collab = $project->collaborators()
            ->where('users.id', $requester->id)
            ->wherePivot('status', 'pending')
            ->first();

        if (!$collab) {
            return response()->json(['message' => 'No pending request found.'], 404);
        }

        $project->collaborators()->detach($requester->id);

        // Notify the requester
        try {
            Notification::create([
                'user_id' => $requester->id,
                'type'    => 'access_request_declined',
                'title'   => 'Access request declined',
                'message' => "Your request to edit \"{$project->name}\" was declined.",
                'data'    => [
                    'project_id'   => $project->id,
                    'project_name' => $project->name,
                ],
            ]);
        } catch (\Throwable $e) {}

        // Remove the access_requested notification so the bell clears automatically
        Notification::where('user_id', $project->owner_id)
            ->where('type', 'access_requested')
            ->whereJsonContains('data->actor_id', (int) $requester->id)
            ->whereJsonContains('data->project_id', (int) $project->id)
            ->delete();

        return response()->json(['message' => 'Request declined.']);
    }

    private function ownerOnly($user, $project)
    {
        if ($project->owner_id !== $user->id) {
            abort(403, 'Only the project owner can manage collaborators.');
        }
    }
}

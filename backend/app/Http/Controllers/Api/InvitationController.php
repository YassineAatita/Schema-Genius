<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Notification;
use App\Models\Project;
use Illuminate\Http\Request;

class InvitationController extends Controller
{
    // GET /api/invitations
    public function index(Request $request)
    {
        $user = $request->user();

        $pending = $user->collaboratingProjects()
            ->wherePivot('status', 'pending')
            ->with('owner:id,name,email')
            ->get()
            // Exclude records the user created themselves (access requests).
            // Those are identified by an 'access_requested' notification in the owner's inbox
            // where data->actor_id == current user.  The user cannot accept their own requests.
            ->filter(function ($p) use ($user) {
                return !Notification::where('type', 'access_requested')
                    ->where('user_id', $p->owner_id)
                    ->whereJsonContains('data->actor_id', (int) $user->id)
                    ->whereJsonContains('data->project_id', (int) $p->id)
                    ->exists();
            })
            ->values()
            ->map(fn($p) => [
                'project_id'   => $p->id,
                'project_name' => $p->name,
                'owner'        => $p->owner,
                'role'         => $p->pivot->role,
                'invited_at'   => $p->pivot->invited_at,
            ]);

        return response()->json($pending);
    }

    // POST /api/invitations/{projectId}/accept
    public function accept(Request $request, $projectId)
    {
        $user    = $request->user();
        $project = Project::findOrFail($projectId);

        $pivot = $project->collaborators()
            ->wherePivot('user_id', $user->id)
            ->wherePivot('status', 'pending')
            ->first();

        if (!$pivot) {
            return response()->json(['message' => 'Invitation not found.'], 404);
        }

        // Prevent self-acceptance: if this pending record came from an access request
        // (visitor requested → owner must approve), block the user from accepting it themselves.
        $isOwnRequest = Notification::where('type', 'access_requested')
            ->where('user_id', $project->owner_id)
            ->whereJsonContains('data->actor_id', (int) $user->id)
            ->whereJsonContains('data->project_id', (int) $project->id)
            ->exists();

        if ($isOwnRequest) {
            return response()->json([
                'message' => 'This is a pending access request — the project owner must approve it.',
            ], 403);
        }

        $project->collaborators()->updateExistingPivot($user->id, ['status' => 'accepted']);

        // Notify the project owner
        Notification::create([
            'user_id' => $project->owner_id,
            'type'    => 'invitation_accepted',
            'title'   => 'Invitation accepted',
            'message' => "{$user->name} accepted your invitation to \"{$project->name}\"",
            'data'    => ['project_id' => $project->id, 'actor_name' => $user->name, 'actor_avatar' => $user->avatar_url],
        ]);

        return response()->json(['message' => 'Invitation accepted.']);
    }

    // POST /api/invitations/{projectId}/decline
    public function decline(Request $request, $projectId)
    {
        $user    = $request->user();
        $project = Project::findOrFail($projectId);

        $pivot = $project->collaborators()
            ->wherePivot('user_id', $user->id)
            ->wherePivot('status', 'pending')
            ->first();

        if (!$pivot) {
            return response()->json(['message' => 'Invitation not found.'], 404);
        }

        $project->collaborators()->detach($user->id);

        // Notify the project owner
        Notification::create([
            'user_id' => $project->owner_id,
            'type'    => 'invitation_declined',
            'title'   => 'Invitation declined',
            'message' => "{$user->name} declined your invitation to \"{$project->name}\"",
            'data'    => ['project_id' => $project->id, 'actor_name' => $user->name, 'actor_avatar' => $user->avatar_url],
        ]);

        return response()->json(['message' => 'Invitation declined.']);
    }
}

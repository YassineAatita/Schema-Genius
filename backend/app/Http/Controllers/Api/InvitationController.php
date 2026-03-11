<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Project;
use Illuminate\Http\Request;

class InvitationController extends Controller
{
    // GET /api/invitations
    // Returns all pending invitations for the authenticated user
    public function index(Request $request)
    {
        $user = $request->user();

        $pending = $user->collaboratingProjects()
            ->wherePivot('status', 'pending')
            ->with('owner:id,name,email')
            ->get()
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

        $project->collaborators()->updateExistingPivot($user->id, ['status' => 'accepted']);

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

        return response()->json(['message' => 'Invitation declined.']);
    }
}

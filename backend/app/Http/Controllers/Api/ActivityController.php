<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ActivityController extends Controller
{
    // GET /api/activity
    // Returns the 20 most recent activity items that are relevant to the
    // authenticated user: actions they performed themselves, plus actions on
    // projects they own or collaborate on (accepted status only).
    public function index(Request $request)
    {
        $user = $request->user();

        // Collect project IDs the user cares about
        $ownedIds = $user->projects()->pluck('projects.id');

        $colabIds = DB::table('project_collaborators')
            ->where('user_id', $user->id)
            ->where('status', 'accepted')
            ->pluck('project_id');

        $projectIds = $ownedIds->concat($colabIds)->unique()->values();

        $logs = ActivityLog::with(['user', 'project'])
            ->where(function ($q) use ($user, $projectIds) {
                // actions by the user, OR actions on their projects
                $q->where('user_id', $user->id);
                if ($projectIds->isNotEmpty()) {
                    $q->orWhereIn('project_id', $projectIds);
                }
            })
            ->orderBy('created_at', 'desc')
            ->limit(20)
            ->get();

        return response()->json(
            $logs->map(fn ($log) => [
                'id'         => $log->id,
                'action'     => $log->action,
                'metadata'   => $log->metadata,
                'created_at' => $log->created_at,
                'user'       => [
                    'id'         => $log->user->id,
                    'name'       => $log->user->name,
                    'avatar_url' => $log->user->avatar_url,
                ],
                'project'    => $log->project ? [
                    'id'   => $log->project->id,
                    'name' => $log->project->name,
                ] : null,
            ])
        );
    }
}

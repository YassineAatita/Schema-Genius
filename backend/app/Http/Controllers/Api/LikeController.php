<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Notification;
use App\Models\Project;
use App\Models\ProjectLike;
use Illuminate\Http\Request;

class LikeController extends Controller
{
    // POST /api/projects/{id}/like
    public function store(Request $request, $id)
    {
        $project = Project::where('visibility', 'public')->findOrFail($id);
        $user    = $request->user();

        if ($project->owner_id === $user->id) {
            return response()->json(['error' => 'You cannot like your own project.'], 403);
        }

        $already = ProjectLike::where('user_id', $user->id)
                               ->where('project_id', $project->id)
                               ->exists();
        if ($already) {
            return response()->json(['error' => 'Already liked.'], 409);
        }

        ProjectLike::create(['user_id' => $user->id, 'project_id' => $project->id]);

        // Notify the project owner (wrapped in try/catch for resilience)
        try {
            Notification::create([
                'user_id' => $project->owner_id,
                'type'    => 'project_liked',
                'title'   => 'Someone liked your schema',
                'message' => "{$user->name} liked \"{$project->name}\".",
                'data'    => [
                    'project_id' => $project->id,
                    'actor_id'   => $user->id,
                    'actor_name' => $user->name,
                ],
            ]);
        } catch (\Throwable $e) {
            // Notification failure must not fail the like action
        }

        $count = ProjectLike::where('project_id', $project->id)->count();
        return response()->json(['liked' => true, 'likes' => $count], 201);
    }

    // DELETE /api/projects/{id}/like
    public function destroy(Request $request, $id)
    {
        $project = Project::findOrFail($id);
        $user    = $request->user();

        ProjectLike::where('user_id', $user->id)
                   ->where('project_id', $project->id)
                   ->delete();

        $count = ProjectLike::where('project_id', $project->id)->count();
        return response()->json(['liked' => false, 'likes' => $count]);
    }
}

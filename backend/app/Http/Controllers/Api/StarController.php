<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Notification;
use App\Models\Project;
use App\Models\ProjectStar;
use Illuminate\Http\Request;

class StarController extends Controller
{
    // POST /api/projects/{id}/star
    public function store(Request $request, $id)
    {
        $project = Project::where('visibility', 'public')->findOrFail($id);
        $user    = $request->user();

        if ($project->owner_id === $user->id) {
            return response()->json(['error' => 'You cannot star your own project.'], 403);
        }

        $already = ProjectStar::where('user_id', $user->id)
                               ->where('project_id', $project->id)
                               ->exists();
        if ($already) {
            return response()->json(['error' => 'Already starred.'], 409);
        }

        ProjectStar::create(['user_id' => $user->id, 'project_id' => $project->id]);

        // Notify the project owner
        if ($project->owner_id !== $user->id) {
            Notification::create([
                'user_id' => $project->owner_id,
                'type'    => 'project_starred',
                'title'   => 'Someone starred your schema',
                'message' => "{$user->name} starred "{$project->name}".",
                'data'    => ['project_id' => $project->id, 'actor_id' => $user->id, 'actor_name' => $user->name],
            ]);
        }

        $count = ProjectStar::where('project_id', $project->id)->count();
        return response()->json(['starred' => true, 'stars' => $count], 201);
    }

    // DELETE /api/projects/{id}/star
    public function destroy(Request $request, $id)
    {
        $project = Project::findOrFail($id);
        $user    = $request->user();

        ProjectStar::where('user_id', $user->id)
                   ->where('project_id', $project->id)
                   ->delete();

        $count = ProjectStar::where('project_id', $project->id)->count();
        return response()->json(['starred' => false, 'stars' => $count]);
    }
}

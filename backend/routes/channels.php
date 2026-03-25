<?php

use App\Models\Project;
use Illuminate\Support\Facades\Broadcast;

/*
|--------------------------------------------------------------------------
| Broadcast Channels
|--------------------------------------------------------------------------
| project.{projectId}  — presence channel for live collaboration
| Auth: owner always allowed; accepted collaborators (editor + viewer) allowed
*/

Broadcast::channel('project.{projectId}', function ($user, $projectId) {
    $project = Project::with('collaborators')->find((int) $projectId);

    if (!$project) {
        return false;
    }

    // Owner
    if ($project->owner_id === $user->id) {
        return [
            'id'         => $user->id,
            'name'       => $user->name,
            'avatar_url' => $user->avatar_url,
        ];
    }

    // Accepted collaborator (editor or viewer)
    $collab = $project->collaborators
        ->where('id', $user->id)
        ->first();

    if ($collab && $collab->pivot->status === 'accepted') {
        return [
            'id'         => $user->id,
            'name'       => $user->name,
            'avatar_url' => $user->avatar_url,
        ];
    }

    return false;
});

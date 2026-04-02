<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Notification;
use App\Models\User;
use App\Models\UserFollow;
use Illuminate\Http\Request;

class FollowController extends Controller
{
    // POST /api/users/{id}/follow
    public function store(Request $request, $id)
    {
        $target = User::findOrFail($id);
        $user   = $request->user();

        if ($target->id === $user->id) {
            return response()->json(['error' => 'You cannot follow yourself.'], 403);
        }

        $already = UserFollow::where('follower_id', $user->id)
                              ->where('following_id', $target->id)
                              ->exists();
        if ($already) {
            return response()->json(['error' => 'Already following.'], 409);
        }

        UserFollow::create(['follower_id' => $user->id, 'following_id' => $target->id]);

        // Notify the target user
        Notification::create([
            'user_id' => $target->id,
            'type'    => 'new_follower',
            'title'   => 'New follower',
            'message' => "{$user->name} started following you.",
            'data'    => ['actor_id' => $user->id, 'actor_name' => $user->name],
        ]);

        return response()->json(['following' => true], 201);
    }

    // DELETE /api/users/{id}/follow
    public function destroy(Request $request, $id)
    {
        $user = $request->user();

        UserFollow::where('follower_id', $user->id)
                  ->where('following_id', $id)
                  ->delete();

        return response()->json(['following' => false]);
    }

    // GET /api/users/{id}/followers
    public function followers($id)
    {
        $user = User::findOrFail($id);

        $followers = UserFollow::where('following_id', $user->id)
            ->with('follower')
            ->latest()
            ->paginate(30);

        $items = $followers->getCollection()->map(fn ($f) => [
            'id'         => $f->follower->id,
            'name'       => $f->follower->name,
            'avatar_url' => $f->follower->avatar_url,
            'user_type'  => $f->follower->user_type,
            'headline'   => $f->follower->headline,
            'followed_at'=> $f->created_at,
        ]);

        return response()->json([
            'data'  => $items,
            'total' => $followers->total(),
        ]);
    }

    // GET /api/users/{id}/following
    public function following($id)
    {
        $user = User::findOrFail($id);

        $following = UserFollow::where('follower_id', $user->id)
            ->with('following')
            ->latest()
            ->paginate(30);

        $items = $following->getCollection()->map(fn ($f) => [
            'id'          => $f->following->id,
            'name'        => $f->following->name,
            'avatar_url'  => $f->following->avatar_url,
            'user_type'   => $f->following->user_type,
            'headline'    => $f->following->headline,
            'followed_at' => $f->created_at,
        ]);

        return response()->json([
            'data'  => $items,
            'total' => $following->total(),
        ]);
    }

    // GET /api/users/{id}/follow-status — check if auth user follows target (auth required)
    public function status(Request $request, $id)
    {
        $user = $request->user();

        $following = UserFollow::where('follower_id', $user->id)
                               ->where('following_id', $id)
                               ->exists();

        return response()->json(['following' => $following]);
    }
}

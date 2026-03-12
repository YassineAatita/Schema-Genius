<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class ProfileController extends Controller
{
    // GET /api/profile
    public function show(Request $request)
    {
        return response()->json($request->user());
    }

    // PUT /api/profile
    public function update(Request $request)
    {
        $validated = $request->validate([
            'name'      => 'sometimes|string|max:255',
            'headline'  => 'sometimes|nullable|string|max:120',
            'bio'       => 'sometimes|nullable|string|max:1000',
            'user_type' => 'sometimes|in:student,developer,designer,fullstack,other',
        ]);

        $request->user()->update($validated);

        return response()->json($request->user()->fresh());
    }

    // POST /api/profile/avatar
    public function uploadAvatar(Request $request)
    {
        $request->validate([
            'avatar' => 'required|image|mimes:jpeg,png,jpg,gif,webp|max:2048',
        ]);

        $user = $request->user();

        // Delete old avatar if exists (raw value is just the filename)
        $oldFilename = $user->getRawOriginal('avatar_url');
        if ($oldFilename) {
            Storage::disk('public')->delete('avatars/' . basename($oldFilename));
        }

        // Store on the 'public' disk → storage/app/public/avatars/
        $path     = $request->file('avatar')->store('avatars', 'public');
        $filename = basename($path);

        $user->update(['avatar_url' => $filename]);

        // Accessor converts filename → full API URL
        return response()->json(['avatar_url' => $user->fresh()->avatar_url]);
    }

    // GET /api/users/{id}  (public profile)
    public function publicProfile($id)
    {
        $user = \App\Models\User::findOrFail($id);

        return response()->json([
            'id'        => $user->id,
            'name'      => $user->name,
            'user_type' => $user->user_type,
            'headline'  => $user->headline,
            'bio'       => $user->bio,
            'avatar_url'=> $user->avatar_url,
        ]);
    }
}

<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\FeaturedSchema;
use App\Models\Project;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class ProfileController extends Controller
{
    // GET /api/profile  (own profile — auth required)
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

        $path     = $request->file('avatar')->store('avatars', 'public');
        $filename = basename($path);

        $user->update(['avatar_url' => $filename]);

        return response()->json(['avatar_url' => $user->fresh()->avatar_url]);
    }

    // GET /api/users/{id}  — public profile (no auth required; enriched if logged in)
    public function publicProfile(Request $request, $id)
    {
        $user = \App\Models\User::findOrFail($id);

        // Optional Sanctum auth — same pattern as ExploreController.
        // Works on public routes without auth:sanctum middleware.
        $viewer = $request->user('sanctum');

        // ── Stats ─────────────────────────────────────────────────────────────
        $followersCount     = DB::table('user_follows')->where('following_id', $user->id)->count();
        $followingCount     = DB::table('user_follows')->where('follower_id',  $user->id)->count();
        $publicSchemasCount = Project::where('owner_id', $user->id)
                                     ->where('visibility', 'public')
                                     ->count();

        // Total stars received across all the user's public schemas
        $totalStars = DB::table('project_stars')
            ->join('projects', 'project_stars.project_id', '=', 'projects.id')
            ->where('projects.owner_id',   $user->id)
            ->where('projects.visibility', 'public')
            ->count();

        // ── is_following ──────────────────────────────────────────────────────
        $isFollowing = false;
        if ($viewer && $viewer->id !== $user->id) {
            $isFollowing = DB::table('user_follows')
                ->where('follower_id',  $viewer->id)
                ->where('following_id', $user->id)
                ->exists();
        }

        // ── Viewer interaction IDs (for card flags) ───────────────────────────
        $viewerStarredIds = [];
        $viewerLikedIds   = [];
        $viewerForkedIds  = [];
        if ($viewer) {
            $viewerStarredIds = DB::table('project_stars')
                ->where('user_id', $viewer->id)->pluck('project_id')->toArray();
            $viewerLikedIds   = DB::table('project_likes')
                ->where('user_id', $viewer->id)->pluck('project_id')->toArray();
            $viewerForkedIds  = DB::table('project_forks')
                ->where('user_id', $viewer->id)->pluck('original_project_id')->toArray();
        }

        $featuredId = FeaturedSchema::orderBy('week_of', 'desc')->value('project_id');

        // ── Public schemas (paginated) ────────────────────────────────────────
        $projects = Project::where('owner_id', $user->id)
            ->where('visibility', 'public')
            ->with(['schema.currentVersion', 'forkOrigin.originalProject.owner'])
            ->withCount(['stars', 'likes', 'forks', 'comments'])
            ->orderBy('created_at', 'desc')
            ->paginate(12);

        $schemas = $projects->getCollection()->map(
            function ($project) use ($user, $featuredId, $viewerStarredIds, $viewerLikedIds, $viewerForkedIds) {
                $schemaJson     = $project->schema?->currentVersion?->schema_json;
                $thumbnailNodes = [];

                if (is_array($schemaJson) && !empty($schemaJson['nodes'])) {
                    $rawNodes = array_slice($schemaJson['nodes'], 0, 12);
                    $thumbnailNodes = array_values(array_map(fn ($n) => [
                        'name' => $n['data']['name'] ?? 'table',
                        'x'    => (float) ($n['position']['x'] ?? 0),
                        'y'    => (float) ($n['position']['y'] ?? 0),
                    ], $rawNodes));
                }

                $forkedFrom = null;
                if ($project->forkOrigin) {
                    $orig       = $project->forkOrigin->originalProject;
                    $forkedFrom = $orig ? [
                        'id'         => $orig->id,
                        'name'       => $orig->name,
                        'owner_name' => $orig->owner?->name,
                    ] : null;
                }

                return [
                    'id'          => $project->id,
                    'name'        => $project->name,
                    'description' => $project->description,
                    'visibility'  => 'public',
                    'created_at'  => $project->created_at,
                    'owner'       => [
                        'id'         => $user->id,
                        'name'       => $user->name,
                        'avatar_url' => $user->avatar_url,
                        'user_type'  => $user->user_type,
                        'headline'   => $user->headline,
                    ],
                    'stats'           => [
                        'stars'    => $project->stars_count    ?? 0,
                        'likes'    => $project->likes_count    ?? 0,
                        'forks'    => $project->forks_count    ?? 0,
                        'comments' => $project->comments_count ?? 0,
                        'tables'   => is_array($schemaJson) ? count($schemaJson['nodes'] ?? []) : 0,
                        'edges'    => is_array($schemaJson) ? count($schemaJson['edges'] ?? []) : 0,
                    ],
                    'is_starred'      => in_array($project->id, $viewerStarredIds),
                    'is_liked'        => in_array($project->id, $viewerLikedIds),
                    'is_forked'       => in_array($project->id, $viewerForkedIds),
                    'is_featured'     => $project->id === $featuredId,
                    'forked_from'     => $forkedFrom,
                    'schema_id'       => $project->schema?->id,
                    'thumbnail_nodes' => $thumbnailNodes,
                ];
            }
        );

        return response()->json([
            'user' => [
                'id'         => $user->id,
                'name'       => $user->name,
                'user_type'  => $user->user_type,
                'headline'   => $user->headline,
                'bio'        => $user->bio,
                'avatar_url' => $user->avatar_url,
                'created_at' => $user->created_at,
            ],
            'stats' => [
                'public_schemas' => $publicSchemasCount,
                'followers'      => $followersCount,
                'following'      => $followingCount,
                'total_stars'    => $totalStars,
            ],
            'is_following' => $isFollowing,
            'schemas'      => [
                'data' => $schemas,
                'meta' => [
                    'current_page' => $projects->currentPage(),
                    'last_page'    => $projects->lastPage(),
                    'per_page'     => $projects->perPage(),
                    'total'        => $projects->total(),
                ],
            ],
        ]);
    }
}

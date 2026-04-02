<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\FeaturedSchema;
use App\Models\Project;
use App\Models\ProjectFork;
use App\Models\UserFollow;
use App\Models\Friendship;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ExploreController extends Controller
{
    // ── Helpers ───────────────────────────────────────────────────────────────

    /** Build the base public-projects query with counts eager-loaded. */
    private function publicQuery()
    {
        return Project::where('visibility', 'public')
            ->with(['owner', 'schema.currentVersion', 'forkOrigin.originalProject.owner'])
            ->withCount(['stars', 'likes', 'forks', 'comments']);
    }

    /** Map a Project model to the standard explore card payload. */
    private function formatCard(Project $project, array $starredIds, array $likedIds, array $forkedIds, ?int $featuredId): array
    {
        $schemaJson = $project->schema?->currentVersion?->schema_json;

        // Fork origin — show where this schema came from
        $forkedFrom = null;
        if ($project->forkOrigin) {
            $orig = $project->forkOrigin->originalProject;
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
            'visibility'  => $project->visibility,
            'created_at'  => $project->created_at,
            'owner'       => [
                'id'        => $project->owner->id,
                'name'      => $project->owner->name,
                'avatar_url'=> $project->owner->avatar_url,
                'user_type' => $project->owner->user_type,
                'headline'  => $project->owner->headline,
            ],
            'stats' => [
                'stars'    => $project->stars_count,
                'likes'    => $project->likes_count,
                'forks'    => $project->forks_count,
                'comments' => $project->comments_count,
                'tables'   => is_array($schemaJson) ? count($schemaJson['nodes'] ?? []) : 0,
                'edges'    => is_array($schemaJson) ? count($schemaJson['edges'] ?? []) : 0,
            ],
            'is_starred'   => in_array($project->id, $starredIds),
            'is_liked'     => in_array($project->id, $likedIds),
            'is_forked'    => in_array($project->id, $forkedIds),
            'is_featured'  => $project->id === $featuredId,
            'forked_from'  => $forkedFrom,
            'schema_id'    => $project->schema?->id,
        ];
    }

    /** Collect the auth-user's interaction IDs for formatting. Returns empty arrays for guests. */
    private function userInteractionIds(?int $userId): array
    {
        if (!$userId) {
            return [[], [], []];
        }
        $starredIds = ProjectFork::query(); // placeholder — overridden below
        $starredIds = DB::table('project_stars')->where('user_id', $userId)->pluck('project_id')->toArray();
        $likedIds   = DB::table('project_likes')->where('user_id', $userId)->pluck('project_id')->toArray();
        $forkedIds  = DB::table('project_forks')->where('user_id', $userId)->pluck('original_project_id')->toArray();
        return [$starredIds, $likedIds, $forkedIds];
    }

    // ── GET /api/explore — Discover (public, guests allowed) ──────────────────

    public function index(Request $request)
    {
        $user   = $request->user();
        $search = $request->query('search');
        $sortBy = $request->query('sort', 'recent'); // recent | popular | stars | forks | trending

        $query = $this->publicQuery();

        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('description', 'like', "%{$search}%");
            });
        }

        match ($sortBy) {
            'popular'  => $query->orderByRaw('(stars_count + likes_count) DESC')->orderBy('created_at', 'desc'),
            'stars'    => $query->orderBy('stars_count', 'desc')->orderBy('created_at', 'desc'),
            'forks'    => $query->orderBy('forks_count', 'desc')->orderBy('created_at', 'desc'),
            'trending' => $query->orderByRaw('(stars_count + likes_count + forks_count) DESC')->orderBy('created_at', 'desc'),
            default    => $query->orderBy('created_at', 'desc'),
        };

        $paginated = $query->paginate(20);

        [$starredIds, $likedIds, $forkedIds] = $this->userInteractionIds($user?->id);
        $featuredId = FeaturedSchema::orderBy('week_of', 'desc')->value('project_id');

        $items = $paginated->getCollection()->map(
            fn ($p) => $this->formatCard($p, $starredIds, $likedIds, $forkedIds, $featuredId)
        );

        return response()->json([
            'data' => $items,
            'meta' => [
                'current_page' => $paginated->currentPage(),
                'last_page'    => $paginated->lastPage(),
                'per_page'     => $paginated->perPage(),
                'total'        => $paginated->total(),
            ],
        ]);
    }

    // ── GET /api/explore/network — My Network (auth required) ─────────────────

    public function network(Request $request)
    {
        $user = $request->user();

        // Collect IDs of people the user follows
        $followingIds = DB::table('user_follows')
            ->where('follower_id', $user->id)
            ->pluck('following_id');

        // Collect IDs of accepted friends (both directions)
        $friendIds = DB::table('friendships')
            ->where('status', 'accepted')
            ->where(function ($q) use ($user) {
                $q->where('requester_id', $user->id)
                  ->orWhere('receiver_id', $user->id);
            })
            ->get()
            ->map(fn ($f) => $f->requester_id === $user->id ? $f->receiver_id : $f->requester_id);

        $networkIds = $followingIds->concat($friendIds)->unique()->values();

        if ($networkIds->isEmpty()) {
            return response()->json(['data' => [], 'meta' => ['total' => 0]]);
        }

        $query = $this->publicQuery()
            ->whereIn('owner_id', $networkIds)
            ->orderBy('created_at', 'desc');

        $paginated = $query->paginate(20);

        [$starredIds, $likedIds, $forkedIds] = $this->userInteractionIds($user->id);
        $featuredId = FeaturedSchema::orderBy('week_of', 'desc')->value('project_id');

        $items = $paginated->getCollection()->map(
            fn ($p) => $this->formatCard($p, $starredIds, $likedIds, $forkedIds, $featuredId)
        );

        return response()->json([
            'data' => $items,
            'meta' => [
                'current_page' => $paginated->currentPage(),
                'last_page'    => $paginated->lastPage(),
                'per_page'     => $paginated->perPage(),
                'total'        => $paginated->total(),
            ],
        ]);
    }

    // ── GET /api/explore/my-schemas — My public + private projects (auth required) ──

    public function mySchemas(Request $request)
    {
        $user = $request->user();

        $projects = Project::where('owner_id', $user->id)
            ->with(['schema.currentVersion', 'forkOrigin.originalProject.owner'])
            ->withCount(['stars', 'likes', 'forks', 'comments'])
            ->orderBy('updated_at', 'desc')
            ->paginate(20);

        $featuredId = FeaturedSchema::orderBy('week_of', 'desc')->value('project_id');

        [$starredIds, $likedIds, $forkedIds] = $this->userInteractionIds($user->id);

        $items = $projects->getCollection()->map(function ($project) use ($featuredId, $starredIds, $likedIds, $forkedIds) {
            $schemaJson = $project->schema?->currentVersion?->schema_json;
            $forkedFrom = null;
            if ($project->forkOrigin) {
                $orig = $project->forkOrigin->originalProject;
                $forkedFrom = $orig ? ['id' => $orig->id, 'name' => $orig->name, 'owner_name' => $orig->owner?->name] : null;
            }
            return [
                'id'          => $project->id,
                'name'        => $project->name,
                'description' => $project->description,
                'visibility'  => $project->visibility,
                'created_at'  => $project->created_at,
                'updated_at'  => $project->updated_at,
                'stats' => [
                    'stars'    => $project->stars_count,
                    'likes'    => $project->likes_count,
                    'forks'    => $project->forks_count,
                    'comments' => $project->comments_count,
                    'tables'   => is_array($schemaJson) ? count($schemaJson['nodes'] ?? []) : 0,
                    'edges'    => is_array($schemaJson) ? count($schemaJson['edges'] ?? []) : 0,
                ],
                'is_featured'  => $project->id === $featuredId,
                'forked_from'  => $forkedFrom,
                'schema_id'    => $project->schema?->id,
            ];
        });

        return response()->json([
            'data' => $items,
            'meta' => [
                'current_page' => $projects->currentPage(),
                'last_page'    => $projects->lastPage(),
                'per_page'     => $projects->perPage(),
                'total'        => $projects->total(),
            ],
        ]);
    }

    // ── GET /api/explore/featured — Current featured schema (public) ───────────

    public function featured(Request $request)
    {
        $featured = FeaturedSchema::with(['project.owner', 'project.schema.currentVersion', 'featuredByUser'])
            ->orderBy('week_of', 'desc')
            ->first();

        if (!$featured || !$featured->project) {
            return response()->json(null);
        }

        $project    = $featured->project;
        $schemaJson = $project->schema?->currentVersion?->schema_json;
        $user       = $request->user();

        [$starredIds, $likedIds, $forkedIds] = $this->userInteractionIds($user?->id);

        $data = $this->formatCard(
            $project->loadCount(['stars', 'likes', 'forks', 'comments']),
            $starredIds, $likedIds, $forkedIds,
            $featured->project_id
        );

        return response()->json(array_merge($data, [
            'featured_note'    => $featured->note,
            'featured_week_of' => $featured->week_of,
            'featured_by'      => $featured->featuredByUser?->name,
        ]));
    }

    // ── GET /api/explore/projects/{id} — Single public project detail ──────────

    public function show(Request $request, $id)
    {
        $project = Project::where('visibility', 'public')
            ->with(['owner', 'schema.currentVersion', 'forkOrigin.originalProject.owner'])
            ->withCount(['stars', 'likes', 'forks', 'comments'])
            ->findOrFail($id);

        $user = $request->user();
        [$starredIds, $likedIds, $forkedIds] = $this->userInteractionIds($user?->id);
        $featuredId = FeaturedSchema::orderBy('week_of', 'desc')->value('project_id');

        return response()->json($this->formatCard($project, $starredIds, $likedIds, $forkedIds, $featuredId));
    }
}

<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\FeaturedSchema;
use App\Models\Project;
use App\Models\ProjectFork;
use App\Models\UserFollow;
use App\Models\Friendship;
use Carbon\Carbon;
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

        // BUG 3 FIX — compact node layout data for unique per-schema thumbnails
        $thumbnailNodes = [];
        if (is_array($schemaJson) && !empty($schemaJson['nodes'])) {
            $rawNodes = array_slice($schemaJson['nodes'], 0, 12);
            $thumbnailNodes = array_values(array_map(fn ($n) => [
                'name' => $n['data']['name'] ?? 'table',
                'x'    => (float) ($n['position']['x'] ?? 0),
                'y'    => (float) ($n['position']['y'] ?? 0),
            ], $rawNodes));
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
                'stars'    => $project->stars_count    ?? 0,
                'likes'    => $project->likes_count    ?? 0,
                'forks'    => $project->forks_count    ?? 0,
                'comments' => $project->comments_count ?? 0,
                'tables'   => is_array($schemaJson) ? count($schemaJson['nodes'] ?? []) : 0,
                'edges'    => is_array($schemaJson) ? count($schemaJson['edges'] ?? []) : 0,
            ],
            'is_starred'      => in_array($project->id, $starredIds),
            'is_liked'        => in_array($project->id, $likedIds),
            'is_forked'       => in_array($project->id, $forkedIds),
            'is_featured'     => $project->id === $featuredId,
            'forked_from'     => $forkedFrom,
            'schema_id'       => $project->schema?->id,
            'thumbnail_nodes' => $thumbnailNodes,  // BUG 3 FIX
        ];
    }

    /**
     * BUG 5 FIX — On public (non-guarded) routes $request->user() always returns null
     * even when a valid Bearer token is present because Sanctum only resolves the user
     * when the auth:sanctum middleware is active. Calling $request->user('sanctum')
     * explicitly invokes the Sanctum guard and returns the authenticated user (or null
     * for guests), so interaction flags (is_starred, is_liked, is_forked) are correct
     * after a browser refresh.
     */
    private function optionalUser($request)
    {
        return $request->user('sanctum');
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
        $user   = $this->optionalUser($request); // BUG 5 FIX
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
            // thumbnail_nodes — same as formatCard so My Schemas tab gets unique thumbnails
            $thumbnailNodes = [];
            if (is_array($schemaJson) && !empty($schemaJson['nodes'])) {
                $rawNodes = array_slice($schemaJson['nodes'], 0, 12);
                $thumbnailNodes = array_values(array_map(fn ($n) => [
                    'name' => $n['data']['name'] ?? 'table',
                    'x'    => (float) ($n['position']['x'] ?? 0),
                    'y'    => (float) ($n['position']['y'] ?? 0),
                ], $rawNodes));
            }
            return [
                'id'          => $project->id,
                'name'        => $project->name,
                'description' => $project->description,
                'visibility'  => $project->visibility,
                'created_at'  => $project->created_at,
                'updated_at'  => $project->updated_at,
                'stats' => [
                    'stars'    => $project->stars_count    ?? 0,
                    'likes'    => $project->likes_count    ?? 0,
                    'forks'    => $project->forks_count    ?? 0,
                    'comments' => $project->comments_count ?? 0,
                    'tables'   => is_array($schemaJson) ? count($schemaJson['nodes'] ?? []) : 0,
                    'edges'    => is_array($schemaJson) ? count($schemaJson['edges'] ?? []) : 0,
                ],
                'is_starred'     => in_array($project->id, $starredIds),
                'is_liked'       => in_array($project->id, $likedIds),
                'is_forked'      => in_array($project->id, $forkedIds),
                'is_featured'    => $project->id === $featuredId,
                'forked_from'    => $forkedFrom,
                'schema_id'      => $project->schema?->id,
                'thumbnail_nodes'=> $thumbnailNodes,
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
    // BUG 7 FIX: If no admin has manually set a featured schema for the current
    // ISO week, the system automatically picks the public schema with the highest
    // combined (stars + likes + comments) score from the last 30 days.
    // Returns null when no qualifying schema exists, hiding the banner entirely.

    public function featured(Request $request)
    {
        $user    = $this->optionalUser($request);
        $weekStart = now()->startOfWeek(\Carbon\Carbon::MONDAY)->toDateString();

        // ── 1. Check for a manually-set pick for the current week ──────────────
        $featured = FeaturedSchema::with(['project.owner', 'project.schema.currentVersion', 'featuredByUser'])
            ->where('week_of', $weekStart)
            ->first();

        if ($featured && $featured->project) {
            // Visibility check — admin can hide the banner without removing the record
            if (!($featured->is_visible ?? true)) {
                return response()->json(null);
            }

            $project = $featured->project;
            $project->load(['schema.currentVersion', 'forkOrigin.originalProject.owner']);
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
                'auto_selected'    => false,
            ]));
        }

        // ── 2. Auto-select: best public schema from the last 30 days ──────────
        // "Best" = highest combined (stars_count + likes_count + comments_count).
        // Skip projects that have already been featured in any previous week.
        $alreadyFeaturedIds = FeaturedSchema::pluck('project_id')->toArray();

        $autoProject = Project::where('visibility', 'public')
            ->with(['owner', 'schema.currentVersion', 'forkOrigin.originalProject.owner'])
            ->withCount(['stars', 'likes', 'forks', 'comments'])
            ->where('created_at', '>=', now()->subDays(30))
            ->when(!empty($alreadyFeaturedIds), fn ($q) => $q->whereNotIn('id', $alreadyFeaturedIds))
            ->orderByRaw('(stars_count + likes_count + comments_count) DESC')
            ->first();

        // Only feature if the schema has at least one community interaction
        if (!$autoProject || ($autoProject->stars_count + $autoProject->likes_count + $autoProject->comments_count) < 1) {
            return response()->json(null);
        }

        // Persist the auto-pick for this week (featured_by = null = system pick).
        // is_visible is intentionally omitted here — new rows default to TRUE via the
        // migration, and omitting it keeps this call safe if the migration hasn't run yet.
        FeaturedSchema::updateOrCreate(
            ['week_of' => $weekStart],
            ['project_id' => $autoProject->id, 'featured_by' => null, 'note' => 'Automatically selected by Schema Genius']
        );

        [$starredIds, $likedIds, $forkedIds] = $this->userInteractionIds($user?->id);

        $data = $this->formatCard(
            $autoProject,
            $starredIds, $likedIds, $forkedIds,
            $autoProject->id
        );

        return response()->json(array_merge($data, [
            'featured_note'    => 'Automatically selected by Schema Genius',
            'featured_week_of' => $weekStart,
            'featured_by'      => null,
            'auto_selected'    => true,
        ]));
    }

    // ── GET /api/explore/projects/{id} — Single public project detail ──────────

    public function show(Request $request, $id)
    {
        $project = Project::where('visibility', 'public')
            ->with(['owner', 'schema.currentVersion', 'forkOrigin.originalProject.owner'])
            ->withCount(['stars', 'likes', 'forks', 'comments'])
            ->findOrFail($id);

        $user = $this->optionalUser($request); // BUG 5 FIX
        [$starredIds, $likedIds, $forkedIds] = $this->userInteractionIds($user?->id);
        $featuredId = FeaturedSchema::orderBy('week_of', 'desc')->value('project_id');

        return response()->json($this->formatCard($project, $starredIds, $likedIds, $forkedIds, $featuredId));
    }
}

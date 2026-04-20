<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AiGeneration;
use App\Models\FeaturedSchema;
use App\Models\Notification;
use App\Models\Project;
use App\Models\ProjectFork;
use App\Models\ProjectLike;
use App\Models\ProjectStar;
use App\Models\Schema;
use App\Models\SchemaComment;
use App\Models\User;
use App\Services\NotificationMailer;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AdminController extends Controller
{
    // ── Guard helper ──────────────────────────────────────────────────────────
    private function requireAdmin(Request $request)
    {
        if (!$request->user()->hasRole('admin')) {
            abort(response()->json(['error' => 'Admin access required.'], 403));
        }
    }

    // GET /api/admin/overview
    // Complete platform stats for the admin dashboard overview panel.
    public function overview(Request $request)
    {
        $this->requireAdmin($request);

        // ── Users ──────────────────────────────────────────────────
        $totalUsers     = User::count();
        $activeUsers    = User::where('is_active', true)->count();
        $newUsersWeek   = User::where('created_at', '>=', now()->subDays(7))->count();
        $newUsersMonth  = User::where('created_at', '>=', now()->subDays(30))->count();

        // ── Projects ───────────────────────────────────────────────
        $totalProjects   = Project::count();
        $publicProjects  = Project::where('visibility', 'public')->count();
        $privateProjects = Project::where('visibility', 'private')->count();
        $newProjectsWeek = Project::where('created_at', '>=', now()->subDays(7))->count();

        // Active projects this week = schemas that had at least one version saved in the last 7 days
        $activeProjectsWeek = Schema::whereHas(
            'versions',
            fn ($q) => $q->where('created_at', '>=', now()->subDays(7))
        )->count();

        // ── AI Generations ─────────────────────────────────────────
        $totalAiGenerations   = AiGeneration::count();
        $appliedAiGenerations = AiGeneration::where('applied', true)->count();
        $aiGenerationsWeek    = AiGeneration::where('created_at', '>=', now()->subDays(7))->count();

        // ── Engagement ─────────────────────────────────────────────
        $totalStars    = ProjectStar::count();
        $totalLikes    = ProjectLike::count();
        $totalForks    = ProjectFork::count();
        $totalComments = SchemaComment::count();

        // ── Trend sparklines (last 14 days) ────────────────────────
        // Fill all 14 dates with 0 first so gaps don't break the chart
        $dates = collect();
        for ($i = 13; $i >= 0; $i--) {
            $dates->put(now()->subDays($i)->toDateString(), 0);
        }

        $registrationsRaw = User::select(
                DB::raw('DATE(created_at) as date'),
                DB::raw('COUNT(*) as count')
            )
            ->where('created_at', '>=', now()->subDays(14))
            ->groupBy('date')
            ->orderBy('date')
            ->pluck('count', 'date');

        $aiRaw = AiGeneration::select(
                DB::raw('DATE(created_at) as date'),
                DB::raw('COUNT(*) as count')
            )
            ->where('created_at', '>=', now()->subDays(14))
            ->groupBy('date')
            ->orderBy('date')
            ->pluck('count', 'date');

        $registrations14d = $dates->merge($registrationsRaw)->values();
        $aiGenerations14d = $dates->merge($aiRaw)->values();

        return response()->json([
            'users' => [
                'total'      => $totalUsers,
                'active'     => $activeUsers,
                'suspended'  => $totalUsers - $activeUsers,
                'new_week'   => $newUsersWeek,
                'new_month'  => $newUsersMonth,
            ],
            'projects' => [
                'total'        => $totalProjects,
                'public'       => $publicProjects,
                'private'      => $privateProjects,
                'new_week'     => $newProjectsWeek,
                'active_week'  => $activeProjectsWeek,
            ],
            'ai' => [
                'total'   => $totalAiGenerations,
                'applied' => $appliedAiGenerations,
                'week'    => $aiGenerationsWeek,
            ],
            'engagement' => [
                'stars'    => $totalStars,
                'likes'    => $totalLikes,
                'forks'    => $totalForks,
                'comments' => $totalComments,
            ],
            'trends' => [
                'registrations_14d' => $registrations14d,
                'ai_14d'            => $aiGenerations14d,
            ],
        ]);
    }

    // GET /api/admin/users  — paginated user list with search, status & role filters
    public function users(Request $request)
    {
        $this->requireAdmin($request);

        $q      = $request->query('q');
        $status = $request->query('status');   // 'active' | 'suspended'
        $role   = $request->query('role');     // 'admin'  | 'developer'

        $users = User::with('roles')
            ->withCount('projects')
            ->when($q, fn ($query) =>
                $query->where(fn ($inner) =>
                    $inner->where('name', 'like', "%{$q}%")
                          ->orWhere('email', 'like', "%{$q}%")
                )
            )
            ->when($status === 'active',    fn ($query) => $query->where('is_active', true))
            ->when($status === 'suspended', fn ($query) => $query->where('is_active', false))
            ->when($role, fn ($query) => $query->whereHas('roles', fn ($r) => $r->where('name', $role)))
            ->latest()
            ->paginate(20);

        return response()->json($users);
    }

    // PUT /api/admin/users/{id}/toggle-active  — suspend / unsuspend a user
    public function toggleActive(Request $request, $id)
    {
        $this->requireAdmin($request);

        $user = User::findOrFail($id);
        if ($user->id === $request->user()->id) {
            return response()->json(['error' => 'You cannot suspend your own account.'], 422);
        }

        $user->update(['is_active' => !$user->is_active]);

        return response()->json([
            'message'   => $user->is_active ? 'User reactivated.' : 'User suspended.',
            'is_active' => $user->is_active,
        ]);
    }

    // PUT /api/admin/users/{id}/role  — change a user's role
    public function changeRole(Request $request, $id)
    {
        $this->requireAdmin($request);

        $validated = $request->validate([
            'role' => ['required', 'string', 'in:admin,developer'],
        ]);

        $user = User::findOrFail($id);
        if ($user->id === $request->user()->id) {
            return response()->json(['error' => 'You cannot change your own role.'], 422);
        }

        $user->syncRoles([$validated['role']]);

        return response()->json([
            'message' => "Role updated to {$validated['role']}.",
            'roles'   => $user->fresh()->roles->pluck('name'),
        ]);
    }

    // DELETE /api/admin/users/{id}  — permanently delete a user account
    public function destroy(Request $request, $id)
    {
        $this->requireAdmin($request);

        $user = User::findOrFail($id);
        if ($user->id === $request->user()->id) {
            return response()->json(['error' => 'You cannot delete your own account.'], 422);
        }

        $user->delete();   // All FK cascades handle related data

        return response()->json(['message' => 'User account permanently deleted.']);
    }

    // ── Project Management ────────────────────────────────────────────────────

    // GET /api/admin/projects  — paginated list of ALL projects (public + private)
    public function projects(Request $request)
    {
        $this->requireAdmin($request);

        $q          = $request->query('q');
        $visibility = $request->query('visibility');  // 'public' | 'private'

        $projects = Project::with(['owner', 'featuredSchema'])
            ->withCount(['stars', 'likes', 'forks', 'comments'])
            ->when($q, fn ($query) =>
                $query->where(fn ($inner) =>
                    $inner->where('name', 'like', "%{$q}%")
                          ->orWhereHas('owner', fn ($r) => $r->where('name', 'like', "%{$q}%"))
                )
            )
            ->when($visibility, fn ($query) => $query->where('visibility', $visibility))
            ->latest()
            ->paginate(20);

        return response()->json($projects);
    }

    // PUT /api/admin/projects/{id}/force-private  — override visibility to private
    public function forcePrivate(Request $request, $id)
    {
        $this->requireAdmin($request);

        $project = Project::findOrFail($id);

        if ($project->visibility === 'private') {
            return response()->json(['error' => 'Project is already private.'], 422);
        }

        $project->update(['visibility' => 'private']);

        return response()->json([
            'message'    => 'Project has been set to private.',
            'visibility' => 'private',
        ]);
    }

    // POST /api/admin/projects/{id}/feature  — feature as Schema of the Week
    public function featureProject(Request $request, $id)
    {
        $this->requireAdmin($request);

        $project = Project::findOrFail($id);

        if ($project->visibility !== 'public') {
            return response()->json(['error' => 'Only public projects can be featured.'], 422);
        }

        $validated = $request->validate([
            'week_of' => ['required', 'date_format:Y-m-d'],
            'note'    => ['nullable', 'string', 'max:500'],
        ]);

        $featured = FeaturedSchema::updateOrCreate(
            ['week_of' => $validated['week_of']],
            [
                'project_id'  => $project->id,
                'featured_by' => $request->user()->id,
                'note'        => $validated['note'] ?? null,
            ]
        );

        // Notify and email the schema owner about being Schema of the Week
        try {
            Notification::create([
                'user_id' => $project->owner_id,
                'type'    => 'schema_of_the_week',
                'title'   => 'Your schema is featured this week!',
                'message' => "Congratulations! \"{$project->name}\" has been selected as the Schema of the Week.",
                'data'    => [
                    'project_id'   => $project->id,
                    'project_name' => $project->name,
                ],
            ]);
        } catch (\Throwable $e) {
            // Notification failure must not fail the feature action
        }

        NotificationMailer::send($project->owner_id, 'schema_of_the_week', [
            'project_name' => $project->name,
            'project_id'   => $project->id,
        ]);

        return response()->json([
            'message'  => 'Project featured as Schema of the Week.',
            'featured' => $featured,
        ]);
    }

    // DELETE /api/admin/projects/{id}  — permanently delete a project
    public function destroyProject(Request $request, $id)
    {
        $this->requireAdmin($request);

        $project = Project::withTrashed()->findOrFail($id);
        $project->forceDelete();   // FK cascades handle schemas, stars, likes, forks, comments

        return response()->json(['message' => 'Project permanently deleted.']);
    }

    // ── AI Usage Monitoring ───────────────────────────────────────────────────

    // GET /api/admin/ai/stats  — platform-wide AI generation summary + 30-day daily trend
    public function aiStats(Request $request)
    {
        $this->requireAdmin($request);

        $total         = AiGeneration::count();
        $applied       = AiGeneration::where('applied', true)->count();
        $uniqueUsers   = AiGeneration::distinct('user_id')->count('user_id');
        $week          = AiGeneration::where('created_at', '>=', now()->subDays(7))->count();
        $applyRate     = $total > 0 ? round(($applied / $total) * 100, 1) : 0;

        // ── 30-day daily trend ──
        $dates = collect();
        for ($i = 29; $i >= 0; $i--) {
            $dates->put(now()->subDays($i)->toDateString(), 0);
        }

        $raw = AiGeneration::select(
                DB::raw('DATE(created_at) as date'),
                DB::raw('COUNT(*) as count')
            )
            ->where('created_at', '>=', now()->subDays(30))
            ->groupBy('date')
            ->orderBy('date')
            ->pluck('count', 'date');

        $trend30d = $dates->merge($raw)->values();

        return response()->json([
            'total'        => $total,
            'applied'      => $applied,
            'apply_rate'   => $applyRate,
            'unique_users' => $uniqueUsers,
            'week'         => $week,
            'trend_30d'    => $trend30d,
        ]);
    }

    // GET /api/admin/ai/users  — per-user AI usage breakdown, sorted by most active
    public function aiUsers(Request $request)
    {
        $this->requireAdmin($request);

        $q = $request->query('q');

        $users = User::withCount([
                'aiGenerations as generations_count',
                'aiGenerations as applied_count' => fn ($q2) => $q2->where('applied', true),
            ])
            ->having('generations_count', '>', 0)
            ->when($q, fn ($query) =>
                $query->where(fn ($inner) =>
                    $inner->where('name', 'like', "%{$q}%")
                          ->orWhere('email', 'like', "%{$q}%")
                )
            )
            ->orderByDesc('generations_count')
            ->paginate(20);

        // Append last_used per user
        $userIds = $users->pluck('id');
        $lastUsed = AiGeneration::whereIn('user_id', $userIds)
            ->select('user_id', DB::raw('MAX(created_at) as last_used'))
            ->groupBy('user_id')
            ->pluck('last_used', 'user_id');

        $users->getCollection()->transform(function ($u) use ($lastUsed) {
            $u->last_used  = $lastUsed[$u->id] ?? null;
            $u->apply_rate = $u->generations_count > 0
                ? round(($u->applied_count / $u->generations_count) * 100, 1)
                : 0;
            return $u;
        });

        return response()->json($users);
    }

    // GET /api/admin/ai/prompts  — paginated recent prompts, searchable
    public function aiPrompts(Request $request)
    {
        $this->requireAdmin($request);

        $q       = $request->query('q');
        $applied = $request->query('applied');   // '1' | '0' | ''

        $prompts = AiGeneration::with(['user', 'project'])
            ->when($q,              fn ($query) => $query->where('prompt', 'like', "%{$q}%"))
            ->when($applied === '1', fn ($query) => $query->where('applied', true))
            ->when($applied === '0', fn ($query) => $query->where('applied', false))
            ->latest('created_at')
            ->paginate(25);

        // Only send the columns we need (omit heavy response_json)
        $prompts->getCollection()->transform(fn ($g) => [
            'id'         => $g->id,
            'prompt'     => $g->prompt,
            'applied'    => $g->applied,
            'created_at' => $g->created_at,
            'user'       => $g->user
                ? ['id' => $g->user->id, 'name' => $g->user->name, 'avatar_url' => $g->user->avatar_url]
                : null,
            'project'    => $g->project
                ? ['id' => $g->project->id, 'name' => $g->project->name]
                : null,
        ]);

        return response()->json($prompts);
    }

    // ── Community Moderation ──────────────────────────────────────────────────

    // GET /api/admin/community/comments — paginated list of all comments + replies
    public function communityComments(Request $request)
    {
        $this->requireAdmin($request);

        $q    = $request->query('q');       // search comment content
        $type = $request->query('type');    // 'top-level' | 'replies' | '' (all)

        $comments = SchemaComment::with(['author', 'project'])
            ->when($q,                   fn ($q2) => $q2->where('content', 'like', "%{$q}%"))
            ->when($type === 'top-level', fn ($q2) => $q2->whereNull('parent_id'))
            ->when($type === 'replies',   fn ($q2) => $q2->whereNotNull('parent_id'))
            ->latest()
            ->paginate(25);

        return response()->json($comments);
    }

    // DELETE /api/admin/community/comments/{id} — admin remove any comment
    public function destroyComment(Request $request, $id)
    {
        $this->requireAdmin($request);

        $comment = SchemaComment::findOrFail($id);
        $comment->delete();   // parent_id FK cascade removes child replies

        return response()->json(['message' => 'Comment deleted.']);
    }

    // GET /api/admin/community/top-projects — top 10 by stars, likes, and forks
    public function topProjects(Request $request)
    {
        $this->requireAdmin($request);

        $limit = min((int) $request->query('limit', 10), 20);

        $base = fn () => Project::with('owner')
            ->where('visibility', 'public');

        $topStarred = (clone $base())
            ->withCount('stars')
            ->orderByDesc('stars_count')
            ->limit($limit)
            ->get();

        $topLiked = (clone $base())
            ->withCount('likes')
            ->orderByDesc('likes_count')
            ->limit($limit)
            ->get();

        $topForked = (clone $base())
            ->withCount('forks')
            ->orderByDesc('forks_count')
            ->limit($limit)
            ->get();

        return response()->json([
            'top_starred' => $topStarred,
            'top_liked'   => $topLiked,
            'top_forked'  => $topForked,
        ]);
    }
}

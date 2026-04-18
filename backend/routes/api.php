<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\ProjectController;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Storage;
use App\Http\Controllers\Api\SchemaController;
use App\Http\Controllers\Api\AiController;
use App\Http\Controllers\Api\CollaboratorController;
use App\Http\Controllers\Api\InvitationController;
use App\Http\Controllers\Api\ProfileController;
use App\Http\Controllers\Api\FriendshipController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\ExploreController;
use App\Http\Controllers\Api\StarController;
use App\Http\Controllers\Api\LikeController;
use App\Http\Controllers\Api\ForkController;
use App\Http\Controllers\Api\FollowController;
use App\Http\Controllers\Api\CommentController;
use App\Http\Controllers\Api\CollectionController;
use App\Http\Controllers\Api\FeaturedSchemaController;
use App\Http\Controllers\Api\AdminController;


// ── Public routes ────────────────────────────────────────────────
Route::prefix('auth')->group(function () {
    Route::post('/register', [AuthController::class, 'register']);
    Route::post('/login',    [AuthController::class, 'login']);
});

// Bio enhancement is public — called during registration before the user has a token
Route::post('/ai/enhance-bio', [AiController::class, 'enhanceBio']);

// Serve avatar images directly — bypasses storage symlink issues on Windows dev
Route::get('/avatars/{filename}', function (string $filename) {
    // Prevent path traversal
    $filename = basename($filename);
    $path = storage_path('app/public/avatars/' . $filename);

    if (!file_exists($path)) {
        abort(404);
    }

    $mime = mime_content_type($path) ?: 'image/jpeg';
    return response()->file($path, [
        'Content-Type'  => $mime,
        'Cache-Control' => 'public, max-age=86400',
    ]);
});

// ── Protected routes ─────────────────────────────────────────────
Route::middleware('auth:sanctum')->group(function () {

    // Auth
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::get('/auth/me',      [AuthController::class, 'me']);

    // Projects
    // active-counts MUST be declared before apiResource so 'active-counts' is not
    // captured as the {project} wildcard by the GET /projects/{project} show route.
    Route::get('/projects/active-counts',  [ProjectController::class, 'activeCounts']);
    Route::post('/projects/{id}/active',   [ProjectController::class, 'markActive']);
    Route::delete('/projects/{id}/active', [ProjectController::class, 'markInactive']);
    Route::apiResource('projects', ProjectController::class);

    // Schemas
    Route::get('/schemas/{id}',  [SchemaController::class, 'show']);
    Route::put('/schemas/{id}',  [SchemaController::class, 'update']);

    // Version history
    Route::get('/schemas/{id}/versions',                                [SchemaController::class, 'versions']);
    Route::post('/schemas/{id}/versions/{versionId}/restore',           [SchemaController::class, 'restoreVersion']);

    // Export SQL
    Route::get('/schemas/{id}/export/sql', [SchemaController::class, 'exportSql']);

    // AI Schema Generation
    Route::post('/ai/generate',                      [AiController::class, 'generate']);
    Route::post('/ai/generate-from-image',           [AiController::class, 'generateFromImage']);
    Route::patch('/ai/generations/{id}/apply',       [AiController::class, 'markApplied']);

    // Profile
    Route::get('/profile',          [ProfileController::class, 'show']);
    Route::put('/profile',          [ProfileController::class, 'update']);
    Route::post('/profile/avatar',  [ProfileController::class, 'uploadAvatar']);

    // Collaborators
    Route::get('/projects/{id}/collaborators',            [CollaboratorController::class, 'index']);
    Route::post('/projects/{id}/collaborators',           [CollaboratorController::class, 'store']);
    Route::put('/projects/{id}/collaborators/{userId}',   [CollaboratorController::class, 'update']);
    Route::delete('/projects/{id}/collaborators/{userId}',[CollaboratorController::class, 'destroy']);

    // Invitations
    Route::get('/invitations',                            [InvitationController::class, 'index']);
    Route::post('/invitations/{projectId}/accept',        [InvitationController::class, 'accept']);
    Route::post('/invitations/{projectId}/decline',       [InvitationController::class, 'decline']);

    // Notifications
    Route::get('/notifications',           [NotificationController::class, 'index']);
    Route::post('/notifications/read-all', [NotificationController::class, 'markAllRead']);
    Route::delete('/notifications/clear',  [NotificationController::class, 'clear']);

    // Friends & user search
    Route::get('/users/search',              [FriendshipController::class, 'search']);
    Route::get('/friends',                   [FriendshipController::class, 'index']);
    Route::get('/friends/requests',          [FriendshipController::class, 'requests']);
    Route::get('/friends/sent',              [FriendshipController::class, 'sent']);
    Route::post('/friends',                  [FriendshipController::class, 'store']);
    Route::post('/friends/{id}/accept',      [FriendshipController::class, 'accept']);
    Route::post('/friends/{id}/decline',     [FriendshipController::class, 'decline']);
    Route::delete('/friends/{id}',           [FriendshipController::class, 'destroy']);
});

// Public user profiles
Route::get('/users/{id}', [ProfileController::class, 'publicProfile']);

// ── Explore — public endpoints (guests allowed) ───────────────────────────────
Route::get('/explore',               [ExploreController::class, 'index']);    // Discover all public schemas
Route::get('/explore/featured',      [ExploreController::class, 'featured']); // Current featured schema
Route::get('/explore/projects/{id}', [ExploreController::class, 'show']);     // Single public project detail

// Comments are readable by guests
Route::get('/projects/{id}/comments', [CommentController::class, 'index']);

// Public fork listing & Schema DNA tree
Route::get('/projects/{id}/forks',      [ForkController::class, 'index']);
Route::get('/projects/{id}/fork-tree',  [ForkController::class, 'tree']);

// Public follower/following lists
Route::get('/users/{id}/followers', [FollowController::class, 'followers']);
Route::get('/users/{id}/following', [FollowController::class, 'following']);

// ── Explore — auth-required endpoints ────────────────────────────────────────
Route::middleware('auth:sanctum')->group(function () {

    // My Network tab (schemas from people you follow/friend)
    Route::get('/explore/network',     [ExploreController::class, 'network']);
    // My Schemas tab (own projects with stats)
    Route::get('/explore/my-schemas',  [ExploreController::class, 'mySchemas']);

    // Stars
    Route::post('/projects/{id}/star',   [StarController::class, 'store']);
    Route::delete('/projects/{id}/star', [StarController::class, 'destroy']);

    // Likes
    Route::post('/projects/{id}/like',   [LikeController::class, 'store']);
    Route::delete('/projects/{id}/like', [LikeController::class, 'destroy']);

    // Forks
    Route::post('/projects/{id}/fork', [ForkController::class, 'store']);

    // Follow / Unfollow
    Route::post('/users/{id}/follow',        [FollowController::class, 'store']);
    Route::delete('/users/{id}/follow',      [FollowController::class, 'destroy']);
    Route::get('/users/{id}/follow-status',  [FollowController::class, 'status']);

    // Comments (write/edit/delete require auth)
    Route::post('/projects/{id}/comments',  [CommentController::class, 'store']);
    Route::put('/comments/{id}',            [CommentController::class, 'update']);
    Route::delete('/comments/{id}',         [CommentController::class, 'destroy']);

    // Collections
    Route::get('/collections',                                    [CollectionController::class, 'index']);
    Route::post('/collections',                                   [CollectionController::class, 'store']);
    Route::get('/collections/{id}',                               [CollectionController::class, 'show']);
    Route::put('/collections/{id}',                               [CollectionController::class, 'update']);
    Route::delete('/collections/{id}',                            [CollectionController::class, 'destroy']);
    Route::post('/collections/{id}/items',                        [CollectionController::class, 'addItem']);
    Route::delete('/collections/{id}/items/{projectId}',          [CollectionController::class, 'removeItem']);

    // Admin — Featured schema management (role-gated inside controller)
    Route::post('/admin/featured',         [FeaturedSchemaController::class, 'store']);
    Route::get('/admin/featured/history',  [FeaturedSchemaController::class, 'history']);

    // Admin — Dashboard data (role-gated inside AdminController)
    Route::get('/admin/overview',                    [AdminController::class, 'overview']);
    Route::get('/admin/users',                       [AdminController::class, 'users']);
    Route::put('/admin/users/{id}/toggle-active',    [AdminController::class, 'toggleActive']);
    Route::put('/admin/users/{id}/role',             [AdminController::class, 'changeRole']);
    Route::delete('/admin/users/{id}',               [AdminController::class, 'destroy']);

    // Admin — Project management
    Route::get('/admin/projects',                        [AdminController::class, 'projects']);
    Route::put('/admin/projects/{id}/force-private',     [AdminController::class, 'forcePrivate']);
    Route::post('/admin/projects/{id}/feature',          [AdminController::class, 'featureProject']);
    Route::delete('/admin/projects/{id}',                [AdminController::class, 'destroyProject']);

    // Admin — AI usage monitoring
    Route::get('/admin/ai/stats',    [AdminController::class, 'aiStats']);
    Route::get('/admin/ai/users',    [AdminController::class, 'aiUsers']);
    Route::get('/admin/ai/prompts',  [AdminController::class, 'aiPrompts']);

    // Admin — Community moderation
    Route::get('/admin/community/comments',              [AdminController::class, 'communityComments']);
    Route::delete('/admin/community/comments/{id}',      [AdminController::class, 'destroyComment']);
    Route::get('/admin/community/top-projects',          [AdminController::class, 'topProjects']);
});

// Test route — to be removed later
Route::get('/test', function () {
    return response()->json(['message' => 'API is working!']);
});
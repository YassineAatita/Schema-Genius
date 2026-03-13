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
    Route::post('/ai/generate',            [AiController::class, 'generate']);
    Route::post('/ai/generate-from-image', [AiController::class, 'generateFromImage']);

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

// Test route — to be removed later
Route::get('/test', function () {
    return response()->json(['message' => 'API is working!']);
});
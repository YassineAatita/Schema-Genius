<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\ProjectController;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\SchemaController;
use App\Http\Controllers\Api\AiController;
use App\Http\Controllers\Api\CollaboratorController;
use App\Http\Controllers\Api\InvitationController;


// ── Public routes ────────────────────────────────────────────────
Route::prefix('auth')->group(function () {
    Route::post('/register', [AuthController::class, 'register']);
    Route::post('/login',    [AuthController::class, 'login']);
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

    // Export SQL
    Route::get('/schemas/{id}/export/sql', [SchemaController::class, 'exportSql']);

    // AI Schema Generation
    Route::post('/ai/generate', [AiController::class, 'generate']);

    // Collaborators
    Route::get('/projects/{id}/collaborators',            [CollaboratorController::class, 'index']);
    Route::post('/projects/{id}/collaborators',           [CollaboratorController::class, 'store']);
    Route::put('/projects/{id}/collaborators/{userId}',   [CollaboratorController::class, 'update']);
    Route::delete('/projects/{id}/collaborators/{userId}',[CollaboratorController::class, 'destroy']);

    // Invitations
    Route::get('/invitations',                            [InvitationController::class, 'index']);
    Route::post('/invitations/{projectId}/accept',        [InvitationController::class, 'accept']);
    Route::post('/invitations/{projectId}/decline',       [InvitationController::class, 'decline']);
});

// Test route — to be removed later
Route::get('/test', function () {
    return response()->json(['message' => 'API is working!']);
});
<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\ProjectController;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\SchemaController;


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
});

// Test route — to be removed later
Route::get('/test', function () {
    return response()->json(['message' => 'API is working!']);
});
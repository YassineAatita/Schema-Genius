<?php

// CORS allowed origins are driven by the FRONTEND_URL env variable so that the
// same codebase works in dev (localhost:5173) and production (https://your-domain.com)
// without editing source files.
//
// Set CORS_ALLOWED_ORIGINS in .env to a comma-separated list for multiple origins:
//   CORS_ALLOWED_ORIGINS=https://schema-genius.com,https://www.schema-genius.com
// If not set, falls back to FRONTEND_URL, then localhost:5173.

$rawOrigins = env('CORS_ALLOWED_ORIGINS', env('FRONTEND_URL', 'http://localhost:5173'));
$allowedOrigins = array_map('trim', explode(',', $rawOrigins));

return [
    'paths'                    => ['api/*', 'sanctum/csrf-cookie', 'broadcasting/auth'],
    'allowed_methods'          => ['*'],
    'allowed_origins'          => $allowedOrigins,
    'allowed_origins_patterns' => [],
    'allowed_headers'          => ['*'],
    'exposed_headers'          => [],
    'max_age'                  => 86400,   // cache preflight for 24 h
    'supports_credentials'     => false,
];
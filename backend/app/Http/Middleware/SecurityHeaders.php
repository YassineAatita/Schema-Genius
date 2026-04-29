<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Adds security-oriented HTTP response headers to every request.
 *
 *  X-Content-Type-Options  — prevents MIME-type sniffing
 *  X-Frame-Options         — blocks clickjacking via <iframe>
 *  X-XSS-Protection        — legacy XSS filter (set to 0 for modern browsers that use CSP)
 *  Referrer-Policy         — limits Referer header; prevents leaking internal URLs to 3rd parties
 *  Permissions-Policy      — opts out of camera, microphone, geolocation the app never uses
 */
class SecurityHeaders
{
    public function handle(Request $request, Closure $next): Response
    {
        /** @var Response $response */
        $response = $next($request);

        $response->headers->set('X-Content-Type-Options', 'nosniff');
        $response->headers->set('X-Frame-Options', 'SAMEORIGIN');
        $response->headers->set('X-XSS-Protection', '0');
        $response->headers->set('Referrer-Policy', 'strict-origin-when-cross-origin');
        $response->headers->set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

        return $response;
    }
}

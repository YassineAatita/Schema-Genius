<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    // POST /api/auth/register
    public function register(Request $request)
    {
        // Normalise email to lowercase before validation so the unique check
        // and the stored value are always case-insensitive.
        $request->merge(['email' => strtolower(trim($request->input('email', '')))]);

        $validated = $request->validate([
            'name'      => 'required|string|max:255',
            'email'     => 'required|email|unique:users,email',
            'password'  => 'required|string|min:8|confirmed',
            'user_type' => 'nullable|in:student,developer,designer,fullstack,other',
            'headline'  => 'nullable|string|max:120',
            'bio'       => 'nullable|string|max:1000',
        ]);

        $user = User::create([
            'name'      => $validated['name'],
            'email'     => $validated['email'],  // already lowercased above
            'password'  => $validated['password'],  // 'hashed' cast in User model handles Hash::make()
            'user_type' => $validated['user_type'] ?? 'developer',
            'headline'  => $validated['headline'] ?? null,
            'bio'       => $validated['bio'] ?? null,
            'is_active' => true,
        ]);

        // Assign default role
        $user->assignRole('developer');

        $token = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'user'  => $user,
            'token' => $token,
        ], 201);
    }

    // POST /api/auth/login
    public function login(Request $request)
    {
        // Normalise email to lowercase so login is case-insensitive.
        $request->merge(['email' => strtolower(trim($request->input('email', '')))]);

        $request->validate([
            'email'    => 'required|email',
            'password' => 'required|string',
        ]);

        if (!Auth::attempt($request->only('email', 'password'))) {
            throw ValidationException::withMessages([
                'email' => ['The provided credentials are incorrect.'],
            ]);
        }

        $user = Auth::user();

        // Block suspended accounts
        if (!$user->is_active) {
            Auth::logout();
            return response()->json([
                'message' => 'Your account has been suspended.'
            ], 403);
        }

        // Delete old tokens and create a fresh one
        $user->tokens()->delete();
        $token = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'user'  => $user,
            'token' => $token,
        ]);
    }

    // POST /api/auth/logout
    public function logout(Request $request)
    {
        $request->user()->tokens()->delete();

        return response()->json([
            'message' => 'Logged out successfully.'
        ]);
    }

    // GET /api/auth/me
    public function me(Request $request)
    {
        return response()->json($request->user());
    }
}
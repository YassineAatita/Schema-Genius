<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Auth\Events\Verified;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
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
            // Allow re-registration if the existing account is unverified (e.g. the
            // previous attempt failed to send the email).  A verified account keeps
            // the unique constraint so duplicate live accounts are still prevented.
            'email'     => [
                'required', 'email',
                \Illuminate\Validation\Rule::unique('users', 'email')->where(
                    fn ($q) => $q->whereNotNull('email_verified_at')
                ),
            ],
            'password'  => 'required|string|min:8|confirmed',
            'user_type' => 'nullable|in:student,developer,designer,fullstack,other',
            'headline'  => 'nullable|string|max:120',
            'bio'       => 'nullable|string|max:1000',
        ]);

        // If a previous unverified account exists for this email, reuse it
        // (update details + resend) rather than creating a duplicate row.
        $user = User::where('email', $validated['email'])
                    ->whereNull('email_verified_at')
                    ->first();

        if ($user) {
            $user->update([
                'name'      => $validated['name'],
                'password'  => $validated['password'],
                'user_type' => $validated['user_type'] ?? 'developer',
                'headline'  => $validated['headline'] ?? null,
                'bio'       => $validated['bio'] ?? null,
            ]);
        } else {
            $user = User::create([
                'name'      => $validated['name'],
                'email'     => $validated['email'],
                'password'  => $validated['password'],
                'user_type' => $validated['user_type'] ?? 'developer',
                'headline'  => $validated['headline'] ?? null,
                'bio'       => $validated['bio'] ?? null,
                'is_active' => true,
            ]);
            $user->assignRole('developer');
        }

        // Send verification email — wrapped in try/catch so a mail transport
        // failure (e.g. Mailgun sandbox not yet activated) never breaks the
        // registration response. The frontend still shows the "check your email"
        // page; the user can hit Resend once mail is working.
        $mailError = null;
        try {
            $user->sendEmailVerificationNotification();
        } catch (\Throwable $e) {
            $mailError = $e->getMessage();
            \Illuminate\Support\Facades\Log::warning('Verification email failed to send for user ' . $user->id . ': ' . $mailError);
        }

        return response()->json([
            'requires_verification' => true,
            'email'                 => $user->email,
            'message'               => 'Account created! Please check your email and click the verification link before logging in.',
            // Only exposed in local/debug so devs know mail is misconfigured
            'mail_error'            => config('app.debug') ? $mailError : null,
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

        // Block unverified accounts
        if (!$user->hasVerifiedEmail()) {
            Auth::logout();
            return response()->json([
                'error'   => 'email_not_verified',
                'email'   => $user->email,
                'message' => 'Please verify your email before logging in.',
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

    // GET /api/auth/email/verify/{id}/{hash}
    // Called directly by the browser when the user clicks the email link.
    // Validates the signed URL, marks the email verified, then redirects to the frontend.
    public function verifyEmail(Request $request, $id, $hash)
    {
        $frontendUrl = config('app.frontend_url', 'http://localhost:5173');

        $user = User::find($id);

        // Unknown user
        if (!$user) {
            return redirect($frontendUrl . '/email-verified?error=invalid');
        }

        // Hash mismatch — link was tampered with
        if (!hash_equals((string) $hash, sha1($user->getEmailForVerification()))) {
            return redirect($frontendUrl . '/email-verified?error=invalid');
        }

        // Signature expired or tampered
        if (!$request->hasValidSignature()) {
            return redirect($frontendUrl . '/email-verified?error=expired');
        }

        // Already verified — just redirect to success
        if ($user->hasVerifiedEmail()) {
            return redirect($frontendUrl . '/email-verified?already=1');
        }

        $user->markEmailAsVerified();
        event(new Verified($user));

        return redirect($frontendUrl . '/email-verified?success=1');
    }

    // POST /api/auth/email/resend
    // Public endpoint — takes an email address, resends if the account exists and is unverified.
    // Always returns 200 to avoid leaking whether an email is registered.
    public function resendVerification(Request $request)
    {
        $request->validate(['email' => 'required|email']);

        $user = User::where('email', strtolower(trim($request->email)))->first();

        if ($user && !$user->hasVerifiedEmail()) {
            try {
                $user->sendEmailVerificationNotification();
            } catch (\Throwable $e) {
                \Illuminate\Support\Facades\Log::warning('Resend verification email failed for user ' . $user->id . ': ' . $e->getMessage());

                // Return a clear error so the frontend can tell the user mail is
                // temporarily unavailable, rather than showing a generic 500.
                return response()->json([
                    'message'    => 'We could not send the email right now. Please try again in a few minutes.',
                    'mail_error' => config('app.debug') ? $e->getMessage() : null,
                ], 503);
            }
        }

        return response()->json([
            'message' => 'If that address is registered and unverified, a new link has been sent.',
        ]);
    }

    // POST /api/auth/forgot-password
    // Accepts email, sends reset link. Always returns 200 (prevents email enumeration).
    public function forgotPassword(Request $request)
    {
        $request->validate(['email' => 'required|email']);

        $frontendUrl = config('app.frontend_url', 'http://localhost:5173');

        // Point the reset link at the frontend reset page instead of a backend route
        ResetPassword::createUrlUsing(function ($user, string $token) use ($frontendUrl) {
            return $frontendUrl . '/reset-password?token=' . $token
                 . '&email=' . urlencode($user->getEmailForPasswordReset());
        });

        Password::sendResetLink($request->only('email'));

        // Always return 200 — never reveal whether the email exists
        return response()->json([
            'message' => 'If that email address is registered, you will receive a password reset link shortly.',
        ]);
    }

    // POST /api/auth/reset-password
    // Accepts token + email + password + password_confirmation. Resets the password.
    public function resetPassword(Request $request)
    {
        $request->validate([
            'token'                 => 'required|string',
            'email'                 => 'required|email',
            'password'              => 'required|string|min:8|confirmed',
        ]);

        $status = Password::reset(
            $request->only('email', 'password', 'password_confirmation', 'token'),
            function (User $user, string $password) {
                $user->forceFill([
                    'password'       => Hash::make($password),
                    'remember_token' => Str::random(60),
                ])->save();

                // Revoke all existing API tokens so old sessions cannot be reused
                $user->tokens()->delete();

                event(new PasswordReset($user));
            }
        );

        if ($status === Password::PASSWORD_RESET) {
            return response()->json([
                'message' => 'Your password has been reset successfully. You can now sign in.',
            ]);
        }

        $errors = [
            Password::INVALID_TOKEN   => 'This reset link is invalid or has already been used.',
            Password::INVALID_USER    => 'We could not find an account with that email address.',
            Password::RESET_THROTTLED => 'Too many attempts. Please wait before trying again.',
        ];

        return response()->json([
            'message' => $errors[$status] ?? 'Password reset failed. Please request a new link.',
        ], 422);
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
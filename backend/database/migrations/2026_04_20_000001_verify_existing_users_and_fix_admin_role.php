<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * One-time data fix:
 *
 * 1. Mark every existing unverified user as email-verified so they can log in.
 *    Email verification was introduced after these accounts were created;
 *    they were never sent a link and should not be locked out.
 *
 * 2. Ensure admin@schema-genius.com holds the 'admin' role, not 'developer'.
 *    Uses raw DB queries so the migration never breaks if the model layer changes.
 */
return new class extends Migration
{
    public function up(): void
    {
        // ── 1. Verify all existing users that have no verified_at timestamp ──
        DB::table('users')
            ->whereNull('email_verified_at')
            ->update(['email_verified_at' => now()]);

        // ── 2. Fix admin role ─────────────────────────────────────────────────

        $admin = DB::table('users')
            ->where('email', 'admin@schema-genius.com')
            ->first();

        if (! $admin) {
            return; // Admin account hasn't been seeded yet — nothing to fix.
        }

        // Ensure the admin role row exists (guard_name is 'web' per Spatie default)
        $adminRoleId = DB::table('roles')
            ->where('name', 'admin')
            ->where('guard_name', 'web')
            ->value('id');

        if (! $adminRoleId) {
            $adminRoleId = DB::table('roles')->insertGetId([
                'name'       => 'admin',
                'guard_name' => 'web',
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        // Remove every role currently assigned to this user, then assign admin.
        // This mirrors what Spatie's syncRoles() does under the hood.
        DB::table('model_has_roles')
            ->where('model_type', 'App\\Models\\User')
            ->where('model_id', $admin->id)
            ->delete();

        DB::table('model_has_roles')->insert([
            'role_id'    => $adminRoleId,
            'model_type' => 'App\\Models\\User',
            'model_id'   => $admin->id,
        ]);
    }

    public function down(): void
    {
        // Reverting a data-only migration is intentionally a no-op.
        // Email verified_at timestamps and role assignments should not
        // be blindly rolled back in production.
    }
};

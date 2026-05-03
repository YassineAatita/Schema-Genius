<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;

class AdminSeeder extends Seeder
{
    public function run(): void
    {
        // Guarantee all platform roles exist before we try to assign one.
        // Calling the seeder here makes AdminSeeder safe to run standalone
        // (e.g. `php artisan db:seed --class=AdminSeeder`) without requiring
        // RolesSeeder to have been executed beforehand.
        $this->call(RolesSeeder::class);

        // Create the admin account (or fetch it if already exists)
        $admin = User::firstOrCreate(
            ['email' => 'admin@schema-genius.com'],
            [
                'name'      => 'Admin',
                'password'  => 'Admin@123456',   // hashed automatically by the 'hashed' cast
                'user_type' => 'developer',
                'is_active' => true,
            ]
        );

        // Assign the admin role (idempotent — safe to run multiple times)
        $admin->syncRoles(['admin']);

        $this->command->info('Admin account ready.');
        $this->command->info('   Email    : admin@schema-genius.com');
        $this->command->info('   Password : Admin@123456');
    }
}

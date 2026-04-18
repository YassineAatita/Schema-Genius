<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Role;

class AdminSeeder extends Seeder
{
    public function run(): void
    {
        // Ensure the admin role exists before assigning it
        Role::firstOrCreate(['name' => 'admin', 'guard_name' => 'web']);

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

        $this->command->info('✅ Admin account ready.');
        $this->command->info('   Email    : admin@schema-genius.com');
        $this->command->info('   Password : Admin@123456');
    }
}

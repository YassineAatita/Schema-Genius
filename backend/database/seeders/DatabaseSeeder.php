<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call([
            RolesSeeder::class,  // must run before AdminSeeder so roles exist
            AdminSeeder::class,
        ]);
    }
}
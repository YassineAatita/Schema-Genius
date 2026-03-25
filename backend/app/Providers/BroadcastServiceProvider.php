<?php

namespace App\Providers;

use Illuminate\Support\Facades\Broadcast;
use Illuminate\Support\ServiceProvider;

class BroadcastServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        // Register the broadcasting auth route protected by Sanctum
        Broadcast::routes(['middleware' => ['auth:sanctum']]);

        // Load presence / private channel definitions
        require base_path('routes/channels.php');
    }
}

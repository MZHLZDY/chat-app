<?php

namespace App\Providers;

use Illuminate\Support\Facades\Broadcast;
use Illuminate\Support\ServiceProvider;

class BroadcastServiceProvider extends ServiceProvider
{
    public function boot()
    {
        // Register broadcast auth route with web+auth middleware
        Broadcast::routes(['middleware' => ['web', 'auth']]);

        require base_path('routes/channels.php');
    }
}

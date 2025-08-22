<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot()
{
    \Illuminate\Support\Facades\Event::listen('*', function ($eventName, array $data) {
        if (str_contains($eventName, 'IncomingCall')) {
            \Illuminate\Support\Facades\Log::info("Event fired: {$eventName}", [
                'data' => $data
            ]);
        }
    });
}
}

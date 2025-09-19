<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;
// use Illuminate\Support\Facades\URL;
// use Illuminate\Support\Facades\Event;
// use Illuminate\Support\Facades\Log; 

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

    // if (config('app.env') !== 'production') {
    //         URL::forceScheme('https');
    //     }

    \Illuminate\Support\Facades\Event::listen('*', function ($eventName, array $data) {
        if (str_contains($eventName, 'IncomingCall')) {
            \Illuminate\Support\Facades\Log::info("Event fired: {$eventName}", [
                'data' => $data
            ]);
        }
    });
}
}

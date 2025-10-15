<?php

use App\Http\Middleware\HandleAppearance;
use App\Http\Middleware\HandleInertiaRequests;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Middleware\AddLinkHeadersForPreloadedAssets;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
        channels: __DIR__.'/../routes/channels.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        $middleware->encryptCookies(except: ['appearance', 'sidebar_state']);

        $middleware->web(append: [
            \App\Http\Middleware\UpdateUserLastSeen::class,
            HandleAppearance::class,
            HandleInertiaRequests::class,
            AddLinkHeadersForPreloadedAssets::class,
        ]);

    //     $middleware->trustProxies(
    //     '*', // Argumen pertama untuk $proxies
    //     Illuminate\Http\Request::HEADER_X_FORWARDED_FOR |
    //     Illuminate\Http\Request::HEADER_X_FORWARDED_HOST |
    //     Illuminate\Http\Request::HEADER_X_FORWARDED_PORT |
    //     Illuminate\Http\Request::HEADER_X_FORWARDED_PROTO |
    //     Illuminate\Http\Request::HEADER_X_FORWARDED_AWS_ELB
    // );
    })
    ->withExceptions(function (Exceptions $exceptions) {
        //
    })->create();

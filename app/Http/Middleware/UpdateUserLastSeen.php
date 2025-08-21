<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class UpdateUserLastSeen
{
    public function handle(Request $request, Closure $next)
    {
        // Cek lek user e wes login
        if (Auth::check()) {
            $user = Auth::user();
            // Ben gak ngupdate database terus-terusan saben klik, dewe watesi
            // mek diupdate lek wes luwih teko 1 menit teko update terakhir.
            if (!$user->last_seen || $user->last_seen->lt(now()->subMinutes(1))) {
                $user->last_seen = now();
                $user->save();
            }
        }
        return $next($request);
    }
}
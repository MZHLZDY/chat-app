<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AgoraCallController;
use App\Http\Controllers\ChatController;
use App\Http\Controllers\GroupController;
use App\Http\Controllers\CallController;
use App\Http\Controllers\UserController;
use Inertia\Inertia;

Route::get('/', function () {
    return Inertia::render('Welcome');
})->name('home');

Route::get('dashboard', function () {
    return Inertia::render('Dashboard');
})->middleware(['auth', 'verified'])->name('dashboard');

// Halaman chat
Route::get('chat', function () {
    return Inertia::render('Chat');
})->middleware(['auth', 'verified'])->name('chat');

Route::middleware(['auth'])->group(function () {
    // direct chat (punya kamu)
    Route::get('/chat/contacts', [\App\Http\Controllers\ChatController::class, 'contacts']);
    Route::get('/chat/{user}/messages', [\App\Http\Controllers\ChatController::class, 'messages']);
    Route::post('/chat/send', [\App\Http\Controllers\ChatController::class, 'sendMessage']);

    // groups
    Route::get('/groups', [GroupController::class, 'index']);
    Route::post('/groups', [GroupController::class, 'store']);
    Route::get('/groups/{group}/messages', [GroupController::class, 'messages']);
    Route::post('/groups/{group}/send', [GroupController::class, 'send']);

    // signaling call
    Route::post('/call/signal', [CallController::class, 'signal']);

    Route::prefix('call')->group(function () {
        Route::post('/invite', [AgoraCallController::class, 'inviteCall']);
        Route::post('/answer', [AgoraCallController::class, 'answerCall']);
        Route::post('/end', [AgoraCallController::class, 'endCall']);
        Route::post('/token', [AgoraCallController::class, 'generateToken']);
    });

Route::get('/test-broadcast/{userId}', function($userId) {
    try {
        $caller = auth()->user();
        $callee = \App\Models\User::find($userId);
        
        event(new \App\Events\IncomingCall(
            caller: $caller,
            callee: $callee,
            callType: 'voice',
            channel: 'call-test-'.time()
        ));
        
        return response()->json([
            'status' => 'Broadcast sent to user '.$userId,
            'caller' => $caller->name,
            'callee' => $callee->name
        ]);
    } catch (\Exception $e) {
        return response()->json(['error' => $e->getMessage()], 500);
    }
})->middleware('auth');

    // Route::post('/calls/initiate', [AgoraCallController::class, 'initiateCall']);
    // Route::post('/calls/accept', [AgoraCallController::class, 'acceptCall']);
    // Route::post('/calls/reject', [AgoraCallController::class, 'rejectCall']);
    // Route::post('/calls/end', [AgoraCallController::class, 'endCall']);
    // Route::post('/agora-token', [AgoraCallController::class, 'generateToken']);
});

Route::get('/users', [UserController::class, 'index'])->middleware('auth');

require __DIR__.'/settings.php';
require __DIR__.'/auth.php';

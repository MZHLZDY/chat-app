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

// Route testing di luar middleware group untuk avoid conflict
Route::get('/test-call-broadcast/{userId}', function($userId) {
    try {
        $caller = auth()->user();
        $callee = \App\Models\User::find($userId);
        
        if (!$callee) {
            return response()->json(['error' => 'User not found'], 404);
        }

        $callId = uniqid();
        $channel = 'call-' . $callId;

        event(new \App\Events\IncomingCall(
            caller: $caller,
            callee: $callee,
            callType: 'voice',
            channel: $channel
        ));

        return response()->json([
            'status' => 'success',
            'message' => 'Broadcast sent to user ' . $userId,
            'caller' => $caller->name,
            'callee' => $callee->name,
            'channel' => $channel,
            'call_id' => $callId
        ]);

    } catch (\Exception $e) {
        return response()->json([
            'error' => $e->getMessage(),
            'trace' => $e->getTraceAsString()
        ], 500);
    }
})->middleware('auth');

Route::get('/test-channel-auth', function() {
    try {
        $user = auth()->user();
        $channelName = 'private-user.' . $user->id;
        
        return response()->json([
            'channel' => $channelName,
            'user_id' => $user->id,
            'authenticated' => true
        ]);

    } catch (\Exception $e) {
        return response()->json(['error' => $e->getMessage()], 500);
    }
})->middleware('auth');

Route::middleware(['auth'])->group(function () {
    // direct chat
    Route::get('/chat/contacts', [ChatController::class, 'contacts']);
    Route::get('/chat/{user}/messages', [ChatController::class, 'messages']);
    Route::post('/chat/send', [ChatController::class, 'sendMessage']);

    // groups
    Route::get('/groups', [GroupController::class, 'index']);
    Route::post('/groups', [GroupController::class, 'store']);
    Route::get('/groups/{group}/messages', [GroupController::class, 'messages']);
    Route::post('/groups/{group}/send', [GroupController::class, 'send']);

    // signaling call
    Route::post('/call/signal', [CallController::class, 'signal']);

    // call routes
    Route::prefix('call')->group(function () {
        Route::post('/invite', [AgoraCallController::class, 'inviteCall']);
        Route::post('/answer', [AgoraCallController::class, 'answerCall']);
        Route::post('/end', [AgoraCallController::class, 'endCall']);
        Route::post('/token', [AgoraCallController::class, 'generateToken']);
    });
});

Route::get('/users', [UserController::class, 'index'])->middleware('auth');

require __DIR__.'/settings.php';
require __DIR__.'/auth.php';
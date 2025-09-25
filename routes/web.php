<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AgoraCallController;
use App\Http\Controllers\TwilioCallController;
use App\Http\Controllers\ChatController;
use App\Http\Controllers\GroupController;
use App\Http\Controllers\CallController;
use App\Http\Controllers\UserController;
use App\Http\Controllers\HiddenMessageController;
use App\Http\Controllers\ProfileController;
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

// Test route untuk trigger incoming call
Route::get('/test-call/{userId}', function($userId) {
    $caller = auth()->user();
    $callee = \App\Models\User::find($userId);

    if (!$callee) {
        return response()->json(['error' => 'User tidak ditemukan'], 404);
    }

    // Debug Info
    \Log::info('=== Test call debug ===', [
        'caller' => [
            'id' => $caller->id,
            'name' => $caller->name,
            'email' => $caller->email
        ],
        'callee' => [
            'id' => $callee->id,
            'name' => $callee->name,
            'email' => $callee->email
        ]
    ]);

    event(new \App\Events\IncomingCall (
        caller: $caller,
        callee: $callee,
        callType: 'voice',
        channel: 'call-test-' . time()
    ));

    return response()->json([
        'message' => 'Incoming call triggered to' . $callee->name,
        'caller' => [
            'id' => $caller->id,
            'name' => $caller->name
        ],
        'callee' => [
            'id' => $callee->id,
            'name' => $callee->name
        ]
    ]);
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
    Route::get('/chat/unread-counts', [ChatController::class, 'getUnreadCounts']);
    Route::post('/chat/send', [ChatController::class, 'sendMessage']);
    Route::post('chat/messages/read', [ChatController::class, 'MarkAsRead']);
    Route::post('/messages/file', [ChatController::class, 'storeFile']);
    Route::delete('/messages/{message}', [ChatController::class, 'destroy']);

    // groups
    Route::get('/groups', [GroupController::class, 'index']);
    Route::post('/groups', [GroupController::class, 'store']);
    Route::get('/groups/{group}/messages', [GroupController::class, 'messages']);
    Route::post('/groups/{group}/send', [GroupController::class, 'send']);
    Route::post('/groups/{id}/messages/file', [GroupController::class, 'storeFile']);
    Route::delete('/group-messages/{message}', [GroupController::class, 'destroy']);

    // profile and background
    Route::post('/profile/photo', [ProfileController::class, 'updatePhoto'])->name('profile.photo.update');
    Route::post('/profile/background', [ProfileController::class, 'updateBackground'])->name('profile.background.update');

    // signaling call
    Route::post('/call/signal', [CallController::class, 'signal']);

    // call routes
    Route::prefix('call')->group(function () {
        Route::post('/invite', [AgoraCallController::class, 'inviteCall']);
        Route::post('/answer', [AgoraCallController::class, 'answerCall']);
        Route::post('/end', [AgoraCallController::class, 'endCall']);
        Route::post('/token', [AgoraCallController::class, 'generateToken']);
    });

    Route::prefix('group-call')->as('group-call.')->group(function () {
      Route::post('/invite', [AgoraCallController::class, 'inviteGroupCall'])->name('invite');
      Route::post('/answer', [AgoraCallController::class, 'answerGroupCall'])->name('answer');
      Route::post('/end', [AgoraCallController::class, 'endGroupCall'])->name('end');
      Route::post('/cancel', [AgoraCallController::class, 'cancelGroupCall'])->name('cancel'); // <-- PASTIKAN BARIS INI ADA
      Route::post('/leave', [AgoraCallController::class, 'leaveGroupCall'])->name('leave');
      Route::post('/recall', [AgoraCallController::class, 'recallParticipant'])->name('recall');
      Route::post('/missed', [AgoraCallController::class, 'missedGroupCall'])->name('missed');
      Route::post('/token', [AgoraCallController::class, 'generateGroupToken'])->name('token');
    });

    // Route::prefix('call')->group(function () {
    //     Route::post('/invite', [TwilioCallController::class, 'inviteCall']);
    //     Route::post('/answer', [TwilioCallController::class, 'answerCall']);
    //     Route::post('/end', [TwilioCallController::class, 'endCall']);
    // });

    // Route::prefix('group-call')->as('group-call.')->group(function () {
    //   Route::post('/invite', [TwilioCallController::class, 'inviteGroupCall'])->name('invite');
    //   Route::post('/answer', [TwilioCallController::class, 'answerGroupCall'])->name('answer');
    //   Route::post('/end', [TwilioCallController::class, 'endGroupCall'])->name('end');
    //   Route::post('/cancel', [TwilioCallController::class, 'cancelGroupCall'])->name('cancel'); // <-- PASTIKAN BARIS INI ADA
    //   Route::post('/leave', [TwilioCallController::class, 'leaveGroupCall'])->name('leave');
    //   Route::post('/recall', [TwilioCallController::class, 'recallParticipant'])->name('recall');
    //   Route::post('/missed', [TwiioCallController::class, 'missedGroupCall'])->name('missed');
    // });
});

// Route::post('/twilio/token', [TwilioCallController::class, 'generateToken'])->middleware('auth');
Route::get('/users', [UserController::class, 'index'])->middleware('auth');
Route::post('/messages/hide', [HiddenMessageController::class, 'store'])->middleware('auth');


require __DIR__.'/settings.php';
require __DIR__.'/auth.php';
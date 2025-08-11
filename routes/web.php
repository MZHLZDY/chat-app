<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\ChatController;
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
    Route::get('/chat/contacts', [ChatController::class, 'contacts'])->name('chat.contacts');
    Route::get('/chat/{user}/messages', [ChatController::class, 'messages'])->name('chat.messages');
    Route::post('/chat/send', [ChatController::class, 'send'])->name('chat.send');
    Route::post('/chat/send', [ChatController::class, 'sendMessage']);

});

// Route::middleware(['auth', 'verified'])->group(function () {
//     Route::get('/chat', [ChatController::class, 'index'])->name('chat');
// //     Route::get('chat/{user}', [ChatController::class, 'chatWith'])->name('chat.with');
// //     Route::post('chat/send', [ChatController::class, 'sendMessage'])->name('chat.send');
// //     Route::get('chat/{user}/messages', [ChatController::class, 'getMessages'])->name('chat.messages');
// // //     Route::get('/users/search', [ChatController::class, 'searchUsers'])->name('users.search');
// });


require __DIR__.'/settings.php';
require __DIR__.'/auth.php';

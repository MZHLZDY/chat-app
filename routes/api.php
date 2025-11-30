<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\UserController;

// === JALUR PUBLIC (Bisa ditembak dari HP tanpa Login) ===
Route::post('/register', [AuthController::class, 'register']);
Route::post('/login', [AuthController::class, 'login']);

// === JALUR PRIVATE (Harus Login dulu/Punya Token) ===
Route::middleware('auth:sanctum')->group(function () {
    Route::get('/user', function (Request $request) {
        return $request->user();
    });

    Route::get('/users', [App\Http\Controllers\Api\UserController::class, 'index']);
    Route::post('/profile/photo', [App\Http\Controllers\ProfileController::class, 'updatePhoto']);
    Route::post('/logout', [App\Http\Controllers\Api\AuthController::class, 'logout']);
    // Nanti route untuk kirim pesan/chat ditaruh di sini
});
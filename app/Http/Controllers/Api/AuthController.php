<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Auth;

class AuthController extends Controller
{
    // === REGISTER KHUSUS HP ===
    public function register(Request $request)
    {
        // Validasi
        $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:users',
            'phone_number' => 'required|string|max:20|unique:users', // Wajib ada sesuai RegisterScreen.js
            'password' => 'required|string|min:8',
        ]);

        // Simpan ke Database
        $user = User::create([
            'name' => $request->name,
            'email' => $request->email,
            'phone_number' => $request->phone_number,
            'password' => Hash::make($request->password),
        ]);

        // Buat Token agar HP bisa login otomatis
        $token = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'message' => 'Register berhasil',
            'user' => $user,
            'token' => $token,
        ], 201);
    }

    // === LOGIN KHUSUS HP ===
    public function login(Request $request)
    {
        // Cek apakah inputnya Email atau No HP
        $loginType = filter_var($request->login, FILTER_VALIDATE_EMAIL) ? 'email' : 'phone_number';

        // Jika bukan email & bukan angka, asumsikan username
        if($loginType == 'phone_number' && !is_numeric($request->login)){
            $loginType = 'username';
        }

        // Cek kredensial
        if (!Auth::attempt([$loginType => $request->login, 'password' => $request->password])) {
            return response()->json(['message' => 'Login gagal. Cek data Anda.'], 401);
        }

        // Ambil data user & buat token
        $user = User::where($loginType, $request->login)->first();
        $token = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'message' => 'Login berhasil',
            'user' => $user,
            'token' => $token,
        ]);
    }

    public function logout(Request $request)
    {
        // Menghapus token yang sedang digunakan saat ini
        $request->user()->currentAccessToken()->delete();

        return response()->json(['message' => 'Berhasil Logout']);
    }
}
<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\User;

class UserController extends Controller
{
    public function index(Request $request)
    {
        // Ambil user yang SEDANG login
        $currentUser = $request->user();

        $users = User::where('id', '!=', $currentUser->id)
                     ->orderBy('name', 'asc')
                     ->get();

        return response()->json($users);
    }
}
<?php
namespace App\Http\Controllers;
use App\Models\User;
use Illuminate\Support\Facades\Auth;

class UserController extends Controller
{
    public function index()
    {
        return User::where('id', '!=', Auth::id())->get(['id', 'name', 'last_seen']);
    }
}
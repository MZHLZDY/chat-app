<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;
use Inertia\Response;

class AuthenticatedSessionController extends Controller
{
    /**
     * Show the login page.
     */
    public function create(Request $request): Response
    {
        return Inertia::render('auth/Login', [
            'canResetPassword' => Route::has('password.request'),
            'status' => $request->session()->get('status'),
        ]);
    }

    /**
     * Handle an incoming authentication request.
     */
    public function store(Request $request) // <-- Ganti LoginRequest dadi Request biasa
    {
        // 1. Ambil input sing jenenge 'email' teko form
        $loginInput = $request->input('email');

        // 2. Cek tipe input e (email, nomer, opo liyane)
        $fieldType = filter_var($loginInput, FILTER_VALIDATE_EMAIL) ? 'email' : (is_numeric($loginInput) ? 'phone_number' : 'name');
        
        // 3. Gabungno maneh data request e ben isok divalidasi karo Laravel
        $request->merge([$fieldType => $loginInput]);
        
        // 4. Gawe aturan validasi sing sesuai
        $request->validate([
            $fieldType => 'required|string',
            'password' => 'required|string',
        ]);
        
        // 5. Coba login nggawe kredensial sing wes disiapno
        if (! Auth::attempt($request->only($fieldType, 'password'), $request->boolean('remember'))) {
            // Lek gagal, balekno error
            return back()->withErrors([
                'email' => 'Kredensial tidak cocok.', // Tetep nggawe key 'email' ben ditompo frontend
            ]);
        }

        // Lek berhasil
        $request->session()->regenerate();

        return redirect()->intended(route('dashboard', absolute: false));
    }

    /**
     * Destroy an authenticated session.
     */
    public function destroy(Request $request): RedirectResponse
    {
        Auth::guard('web')->logout();

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect('/');
    }
}

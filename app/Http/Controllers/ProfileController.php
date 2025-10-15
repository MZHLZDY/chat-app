<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use App\Events\UserProfileUpdated;

class ProfileController extends Controller
{
    public function updatePhoto(Request $request)
    {
        $request->validate(['photo' => ['required', 'image', 'max:2048']]);
        $user = auth()->user();

        if ($user->profile_photo_path) {
            Storage::disk('public')->delete($user->profile_photo_path);
        }

        $path = $request->file('photo')->store('profile-photos', 'public');
        $user->update(['profile_photo_path' => $path]);
        broadcast(new UserProfileUpdated($user->fresh()));
        return back();
    }

    public function updateBackground(Request $request)
    {
        $request->validate(['background' => ['required', 'image', 'max:5120']]);
        $user = auth()->user();

        if ($user->background_image_path) {
            Storage::disk('public')->delete($user->background_image_path);
        }

        $path = $request->file('background')->store('background-images', 'public');
        $user->update(['background_image_path' => $path]);
        broadcast(new UserProfileUpdated($user->fresh()));
        return back();
    }
}
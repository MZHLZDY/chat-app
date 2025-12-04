<?php

use Illuminate\Support\Facades\Broadcast;
use Illuminate\Support\Facades\Log;
use App\Models\Group;

Broadcast::channel('chat.{a}.{b}', function ($user, $a, $b) {
    if ((int)$user->id === (int)$a || (int)$user->id === (int)$b) {
        return ['id' => $user->id, 'name' => $user->name, 'profile_photo_url' => $user->profile_photo_url];
    }
    return false;
});

// Channel untuk notifikasi user
Broadcast::channel('notifications.{userId}', function ($user, $userId) {
    return (int) $user->id === (int) $userId;
});

// Channel untuk group chat
Broadcast::channel('group.{groupId}', function ($user, $groupId) {
    return $user->groups()->where('groups.id', $groupId)->exists();
});

// Channel untuk event privat user (seperti update profil & panggilan)
Broadcast::channel('user.{id}', function ($user, $userId) {
    return (int) $user->id === (int) $userId;
});

// Channel untuk private calls (alternatif)
Broadcast::channel('private-user.{userId}', function ($user, $userId) {
    if (!$user) {
        return false;
    }
    
    return (int)$user->id === (int)$userId;
});

Broadcast::channel('users', function ($user) {
    if ($user) {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'profile_photo_url' => $user->profile_photo_url
        ];
    }
});

// Fallback channel untuk testing
Broadcast::channel('test-calls', function ($user) {
    return $user !== null; // Authorization untuk user terautentikasi
});
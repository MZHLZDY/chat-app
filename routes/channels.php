<?php

use Illuminate\Support\Facades\Broadcast;
use App\Models\Group;

Broadcast::channel('chat.{a}.{b}', function ($user, $a, $b) {
    // Pastikan user terautentikasi
    if (!$user) {
        return false;
    }
    
    if ((int)$user->id === (int)$a || (int)$user->id === (int)$b) {
        return ['id' => $user->id, 'name' => $user->name];
    }
    return false;
});

// Channel untuk group
Broadcast::channel('group.{groupId}', function ($user, $groupId) {
    if (!$user) {
        return false;
    }
    
    // Pastikan user adalah member group
    return $user->groups()->where('groups.id', $groupId)->exists();
});

// Channel untuk call - PERBAIKAN IMPORTAN!
Broadcast::channel('user.{userId}', function ($user, $userId) {
    if (!$user) {
        return false;
    }
    
    // Kembalikan data user jika ID match
    return (int)$user->id === (int)$userId ? [
        'id' => $user->id,
        'name' => $user->name,
        'email' => $user->email
    ] : false;
});

// Channel untuk private calls (alternatif)
Broadcast::channel('private-user.{userId}', function ($user, $userId) {
    if (!$user) {
        return false;
    }
    
    return (int)$user->id === (int)$userId;
});

// Fallback channel untuk testing
Broadcast::channel('test-calls', function ($user) {
    return $user !== null; // Authorization untuk user terautentikasi
});
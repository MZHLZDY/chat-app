<?php

use Illuminate\Support\Facades\Broadcast;

Broadcast::channel('chat.{a}.{b}', function ($user, $a, $b) {
    return (int)$user->id === (int)$a || (int)$user->id === (int)$b;
});

// other channels you have...
Broadcast::channel('group.{groupId}', function ($user, $groupId) {
    // KEMBALIKAN KE LOGIKA INI setelah selesai debugging
    return $user->groups()->where('groups.id', $groupId)->exists();
});

Broadcast::channel('call.{userId}', function ($user, $userId) {
    return (int)$user->id === (int)$userId;
});

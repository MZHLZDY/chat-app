<?php

namespace App\Events;

use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;
use App\Models\User;
use App\Models\Group;

class GroupCallAnswered implements ShouldBroadcast
{
    use Dispatchable, SerializesModels;

    public function __construct(
        public string $callId,
        public Group $group,
        public User $user,
        public bool $accepted,
        public ?string $reason = null
    ) {}

    public function broadcastOn(): array
    {
        return [new PrivateChannel('group.' . $this->group->id)];
    }

    public function broadcastAs(): string
    {
        return 'group-call-answered';
    }

    public function broadcastWith(): array
    {
        // ✅ PERBAIKAN: Kirim data user yang LENGKAP termasuk profile_photo_url
        return [
            'call_id' => $this->callId,
            'user' => [
                'id' => $this->user->id,
                'name' => $this->user->name,
                'email' => $this->user->email,
                'profile_photo_url' => $this->user->profile_photo_url, // ✅ KUNCI: Pastikan ini dikirim
            ],
            'accepted' => $this->accepted,
            'reason' => $this->reason,
        ];
    }
}
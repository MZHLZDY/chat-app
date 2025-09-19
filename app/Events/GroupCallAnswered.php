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
        public User $user, // User yang menjawab
        public bool $accepted,
        public ?string $reason
    ) {}

    public function broadcastOn(): array
    {
        // Siarkan ke channel utama grup
        return [ new PrivateChannel('group.' . $this->group->id) ];
    }

    public function broadcastAs(): string
    {
        return 'group-call-answered';
    }

    public function broadcastWith(): array
    {
        return [
            'call_id' => $this->callId,
            'user' => ['id' => $this->user->id, 'name' => $this->user->name],
            'accepted' => $this->accepted,
            'reason' => $this->reason,
        ];
    }
}
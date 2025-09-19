<?php

namespace App\Events;

use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;
use App\Models\User;
use App\Models\Group;

class GroupParticipantLeft implements ShouldBroadcast
{
    use Dispatchable, SerializesModels;

    public function __construct(
        public string $callId,
        public Group $group,
        public User $user // User yang keluar
    ) {}

    public function broadcastOn(): array
    {
        return [ new PrivateChannel('group.' . $this->group->id) ];
    }

    public function broadcastAs(): string
    {
        return 'group-participant-left';
    }

    public function broadcastWith(): array
    {
        return [
            'call_id' => $this->callId,
            'user' => ['id' => $this->user->id, 'name' => $this->user->name],
        ];
    }
}
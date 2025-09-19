<?php

namespace App\Events;

use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;
use App\Models\User;

class GroupCallEnded implements ShouldBroadcast
{
    use Dispatchable, SerializesModels;

    public function __construct(
        public string $callId,
        public int $groupId,
        public User $endedBy,
        public ?string $reason
    ) {}

    public function broadcastOn()
    {
        // Siarkan ke channel utama grup
        return new PrivateChannel('group.' . $this->groupId);
    }

    public function broadcastAs(): string
    {
        return 'group-call-ended';
    }

    public function broadcastWith(): array
    {
        return [
            'call_id' => $this->callId,
            'ended_by' => ['id' => $this->endedBy->id, 'name' => $this->endedBy->name],
            'reason' => $this->reason,
        ];
    }
}
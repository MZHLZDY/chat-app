<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class GroupCallAccepted implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $accepter;
    public $groupId;
    public $callId;

    public function __construct($accepter, $groupId, $callId)
    {
        $this->accepter = $accepter;
        $this->groupId = $groupId;
        $this->callId = $callId;
    }

    public function broadcastOn(): array
    {
        return [
            new Channel('group.' . $this->groupId),
        ];
    }

    public function broadcastAs(): string
    {
        return 'group-call.accepted';
    }

    public function broadcastWith(): array
    {
        return [
            'accepter' => [
                'id' => $this->accepter->id,
                'name' => $this->accepter->name,
            ],
            'call_id' => $this->callId,
        ];
    }
}
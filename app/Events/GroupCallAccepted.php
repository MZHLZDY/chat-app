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
    public $memberIds;

    public function __construct($accepter, $groupId, $callId, $memberIds)
    {
        $this->accepter = $accepter;
        $this->groupId = $groupId;
        $this->callId = $callId;
        $this->memberIds = $memberIds;
    }

    public function broadcastOn(): array
    {
        $channels = [new Channel('group.' . $this->groupId)];

        // broadcast juga ke individual channel untuk user yang menerima panggilan
        foreach ($this->memberIds as $memberId) {
            $channels[] = new Channel('user.' . $memberId);
        }

        return $channels;
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
            'group_id' => $this->groupId,
        ];
    }
}
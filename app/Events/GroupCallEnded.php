<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;
use App\Models\User;

class GroupCallEnded implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $userId;
    public $groupId;
    public $callId;
    public $reason;
    public $duration;
    public $memberIds;

    public function __construct($userId, $groupId, $callId, $reason = 'ended', $duration = 0, $memberIds = [])
    {
        $this->userId = $userId;
        $this->groupId = $groupId;
        $this->callId = $callId;
        $this->reason = $reason;
        $this->duration = $duration;
        $this->memberIds = $memberIds;
    }

    public function broadcastOn(): array
    {
        $channels = [];

        // broadcaast ke semua member individual
        foreach ($this->memberIds as $memberId) {
            $channels[] = new Channel('user.' . $memberId);
        }

        return $channels;
    }

    public function broadcastAs(): string
    {
        return 'group-call.ended';
    }

    public function broadcastWith(): array
    {
        return [
            'user_id' => $this->userId,
            'group_id' => $this->groupId,
            'call_id' => $this->callId,
            'reason' => $this->reason,
            'duration' => $this->duration,
        ];
    }
}
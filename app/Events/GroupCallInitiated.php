<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class GroupCallInitiated implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $caller;
    public $toId;
    public $groupId;
    public $groupName;
    public $callType;
    public $callId;
    public $members;

    public function __construct($caller, $toId, $groupId, $groupName, $callType, $callId, $members)
    {
        $this->caller = $caller;
        $this->toId = $toId;
        $this->groupId = $groupId;
        $this->groupName = $groupName;
        $this->callType = $callType;
        $this->callId = $callId;
        $this->members = $members;
    }

    public function broadcastOn(): array
    {
        return [
            new Channel('user.' . $this->toId),
        ];
    }

    public function broadcastAs(): string
    {
        return 'group-call.incoming';
    }

    public function broadcastWith(): array
    {
        return [
            'caller' => [
                'id' => $this->caller->id,
                'name' => $this->caller->name,
                'avatar' => $this->caller->avatar,
            ],
            'group_id' => $this->groupId,
            'group_name' => $this->groupName,
            'call_type' => $this->callType,
            'call_id' => $this->callId,
            'members' => $this->members,
        ];
    }
}
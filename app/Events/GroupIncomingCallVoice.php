<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class GroupIncomingCallVoice implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $callId;
    public $group;
    public $caller;
    public $callType;
    public $channel;
    public $participants;

    public function __construct($callId, $group, $caller, $callType, $channel, $participants)
    {
        $this->callId = $callId;
        $this->group = $group;
        $this->caller = $caller;
        $this->callType = $callType;
        $this->channel = $channel;
        $this->participants = $participants;
    }

    public function broadcastOn()
    {
        // Broadcast ke channel private setiap peserta
        $channels = [];
        foreach ($this->participants as $participant) {
            $channels[] = new PrivateChannel('user.' . $participant['id']);
        }
        return $channels;
    }

    public function broadcastAs()
    {
        return 'group-incoming-call';
    }

    public function broadcastWith()
    {
        return [
            'callId' => $this->callId,
            'group' => [
                'id' => $this->group->id,
                'name' => $this->group->name
            ],
            'caller' => [
                'id' => $this->caller->id,
                'name' => $this->caller->name
            ],
            'callType' => $this->callType,
            'channel' => $this->channel,
            'participants' => $this->participants
        ];
    }
}


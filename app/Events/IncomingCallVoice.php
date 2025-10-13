<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class IncomingCallVoice implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $caller;
    public $callee;
    public $callType;
    public $channel;
    public $callId;

    public function __construct($caller, $callee, $callType, $channel, $callId)
    {
        $this->caller = $caller;
        $this->callee = $callee;
        $this->callType = $callType;
        $this->channel = $channel;
        $this->callId = $callId;
    }

    public function broadcastOn()
    {
        return new PrivateChannel('user.' . $this->callee->id);
    }

    public function broadcastAs()
    {
        return 'incoming-call';
    }

    public function broadcastWith()
    {
        return [
            'call_id' => $this->callId,
            'caller' => [
                'id' => $this->caller->id,
                'name' => $this->caller->name
            ],
            'call_type' => $this->callType,
            'channel' => $this->channel,
            'timestamp' => now()->toISOString()
        ];
    }
}
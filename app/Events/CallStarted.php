<?php
// app/Events/CallStarted.php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class CallStarted implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $callId;
    public $callType;
    public $channel;
    public $caller;
    public $message;

    public function __construct($callId, $callType, $channel, $caller, $message = null)
    {
        $this->callId = $callId;
        $this->callType = $callType;
        $this->channel = $channel;
        $this->caller = $caller;
        $this->message = $message;
    }

    public function broadcastOn()
    {
        return new PrivateChannel('user.' . $this->caller->id);
    }

    public function broadcastAs()
    {
        return 'call-started';
    }
}
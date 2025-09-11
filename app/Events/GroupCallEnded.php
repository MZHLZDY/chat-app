<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class GroupCallEnded implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $callId;
    public $user;
    public $reason;

    public function __construct($callId, $user, $reason = null)
    {
        $this->callId = $callId;
        $this->user = $user;
        $this->reason = $reason;
    }

    public function broadcastOn()
    {
        // Broadcast ke semua peserta panggilan
        return new PrivateChannel('group-call.' . $this->callId);
    }

    public function broadcastAs()
    {
        return 'group-call-ended';
    }
}


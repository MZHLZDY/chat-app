<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class CallRejected implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $callerId;
    public $reason;

    public function __construct(int $callerId, string $reason)
    {
        $this->callerId = $callerId;
        $this->reason = $reason;
    }

    public function broadcastOn()
    {
        return new Channel('user.' . $this->callerId);
    }

    public function broadcastWith()
    {
        return [
            'reason' => $this->reason,
            'timestamp' => now()->toDateTimeString()
        ];
    }

    public function broadcastAs()
    {
        return 'call-rejected';
    }
}

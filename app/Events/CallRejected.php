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

    public function __construct(
        public int $callerId,
        public string $reason
    ) {}

    public function broadcastOn(): array
    {
        return [
            new PrivateChannel('user.' . $this->callerId),
        ];
    }

    public function broadcastAs(): string
    {
        return 'call-rejected';
    }

    public function broadcastWith(): array
    {
        return [
            'caller_id' => $this->callerId,
            'reason' => $this->reason,
        ];
    }
}
<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class CallAccepted implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $callerId;
    public $callee;
    public $channel;

    public function __construct(int $callerId, User $callee, string $channel)
    {
        $this->callerId = $callerId;
        $this->callee = $callee;
        $this->channel = $channel;
    }

    public function broadcastOn()
    {
        // Broadcast ke caller bahwa panggilan diterima
        return new Channel('user.' . $this->callerId);
    }

    public function broadcastWith()
    {
        return [
            'callee' => [
                'id' => $this->callee->id,
                'name' => $this->callee->name,
                'avatar' => $this->callee->avatar_url
            ],
            'channel' => $this->channel,
            'timestamp' => now()->toDateTimeString()
        ];
    }

    public function broadcastAs()
    {
        return 'call-accepted';
    }
}
<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;
use App\Models\User; // IMPORT YANG BENAR

class CallAccepted implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public int $callerId,
        public User $callee, // App\Models\User
        public string $channel
    ) {}

    public function broadcastOn(): array
    {
        return [
            new PrivateChannel('user.' . $this->callerId),
        ];
    }

    public function broadcastAs(): string
    {
        return 'call-accepted';
    }

    public function broadcastWith(): array
    {
        return [
            'caller_id' => $this->callerId,
            'callee' => [
                'id' => $this->callee->id,
                'name' => $this->callee->name,
            ],
            'channel' => $this->channel,
            'call_id' => str_replace('call-', '', $this->channel),
        ];
    }
}
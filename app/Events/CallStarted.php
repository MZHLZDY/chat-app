<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;
use App\Models\User;

class CallStarted implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
     public string $callId,
     public string $callType,
     public string $channel,
     public User $caller // Terima object User lengkap
    ) {}

    public function broadcastOn(): array
    {
        return [
            new PrivateChannel('user.' . $this->caller->id),
        ];
    }

    public function broadcastAs(): string
    {
        return 'call-started';
    }

    public function broadcastWith(): array
    {
        return [
            'call_id' => $this->callId,
            'call_type' => $this->callType,
            'channel' => $this->channel,
            'caller' => [
                'id' => $this->caller->id,
                'name' => $this->caller->name
            ],
            // 'callee' => [
            //     'id' => $this->callee->id,
            //     'name' => $this->callee->name,
            //     'email' => $this->callee->email
            // ],
            'timestamp' => now()->toISOString()
        ];
    }
}



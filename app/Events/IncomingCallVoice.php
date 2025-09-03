<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;
use App\Models\User;

class IncomingCallVoice implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $caller;
    public $callee;
    public $callType;
    public $channel;

    // PERBAIKAN: Gunakan type hint yang lebih flexible
    public function __construct($caller, $callee, string $callType, string $channel)
    {
        \Log::info('IncomingCall constructor', [
            'caller_id' => $caller->id,
            'callee_id' => $callee->id,
            'call_type' => $callType,
            'channel' => $channel
        ]);

        $this->caller = $caller;
        $this->callee = $callee;
        $this->callType = $callType;
        $this->channel = $channel;
    }

    public function broadcastOn(): array
    {
        \Log::info('Broadcasting to channel: user.' . $this->callee->id);
        
        return [
            new PrivateChannel('user.' . $this->callee->id),
        ];
    }

    public function broadcastAs(): string
    {
        return 'incoming-call';
    }

    public function broadcastWith(): array
    {
        return [
            'caller' => [
                'id' => $this->caller->id,
                'name' => $this->caller->name,
                'email' => $this->caller->email
            ],
            'callee_id' => $this->callee->id,
            'call_type' => $this->callType,
            'channel' => $this->channel,
            'call_id' => str_replace('call-', '', $this->channel),
            'timestamp' => now()->toISOString()
        ];
    }
}
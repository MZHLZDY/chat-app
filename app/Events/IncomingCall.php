<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class IncomingCall implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $caller;
    public $callee;
    public $callType;
    public $channel;

    public function __construct(User $caller, User $callee, string $callType, string $channel)
    {
        $this->caller = $caller;
        $this->callee = $callee;
        $this->callType = $callType;
        $this->channel = $channel;
    }

    public function broadcastOn()
    {
        // Broadcast ke channel private user penerima
        return new Channel('user.' . $this->callee->id);
    }

    public function broadcastAs()
    {
        return 'incoming-call';
    }
}

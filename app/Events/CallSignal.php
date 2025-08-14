<?php

namespace App\Events;

use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Queue\SerializesModels;

class CallSignal implements ShouldBroadcast
{
    use SerializesModels;

    public function __construct(
        public array $payload,          // ['type'=>'offer|answer|candidate', 'from'=>id, 'to'=>id, 'data'=>...]
        public int $toUserId
    ) {}

    public function broadcastOn()
    {
        return new PrivateChannel('call.' . $this->toUserId);
    }

    public function broadcastAs()
    {
        return 'CallSignal';
    }
}

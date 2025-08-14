<?php

namespace App\Events;

use App\Models\GroupMessage;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Queue\SerializesModels;

class GroupMessageSent implements ShouldBroadcast
{
    use SerializesModels;

    public function __construct(public GroupMessage $message) {}

    public function broadcastOn()
    {
        return new PrivateChannel('group.' . $this->message->group_id);
    }

    public function broadcastAs()
    {
        return 'GroupMessageSent';
    }
}

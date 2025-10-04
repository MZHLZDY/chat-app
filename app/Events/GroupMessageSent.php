<?php

namespace App\Events;

use App\Models\GroupMessage; 
use App\Models\Group; 
use App\Models\User; 
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;
use Illuminate\Broadcasting\InteractsWithSockets;

class GroupMessageSent implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $message;

    public function __construct(GroupMessage $message)
    {
        $this->message = $message->load('sender');
    }

    public function broadcastOn(): array
    {
        $memberChannels = $this->message->group->members->map(function (User $member) {
            return new PrivateChannel('notifications.' . $member->id);
        })->all();
        return array_merge(
            [new PrivateChannel('group.' . $this->message->group_id)],
            $memberChannels
        );
    }

    public function broadcastAs(): string
    {
        return 'GroupMessageSent';
    }
}
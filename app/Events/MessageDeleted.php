<?php

namespace App\Events;

use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class MessageDeleted implements ShouldBroadcastNow
{
    use Dispatchable, SerializesModels;

    private $message;

    public function __construct($message)
    {
        $this->message = $message;
    }

    public function broadcastWith(): array
    {
        return ['messageId' => $this->message->id];
    }

    public function broadcastAs(): string
    {
        return 'message.deleted';
    }

    public function broadcastOn(): array
    {
        if ($this->message->group_id) {
            return [new PrivateChannel('group.' . $this->message->group_id)];
        }

        $participants = [$this->message->sender_id, $this->message->receiver_id];
        sort($participants);

        $channelName = 'chat.' . implode('.', $participants);
        return [new PrivateChannel($channelName)];
    }
}
<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;
use App\Models\User;
use App\Models\Message;

class MessageSent implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $id;
    public $message;
    public $sender;
    public $sender_id;
    public $receiver_id;
    public $created_at;

    public function __construct(Message $message)
    {
        $this->id = $message->id;
        $this->message = $message->message;
        $this->sender = $message->sender;
        $this->sender_id = $message->sender_id;
        $this->receiver_id = $message->receiver_id;
        $this->created_at = $message->created_at;
    }

    public function broadcastOn()
    {
        return [
            new PrivateChannel('chat.' . $this->receiver_id),
            new PrivateChannel('chat.' . $this->sender_id),
        ];
    }
}

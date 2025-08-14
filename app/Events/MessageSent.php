<?php

namespace App\Events;

use App\Models\ChatMessage;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Queue\SerializesModels;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Broadcasting\InteractsWithSockets;

class MessageSent implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    // send a simple, safe payload
    public array $message;

    public function __construct(ChatMessage $message)
    {
        $message->load('sender'); // make sure sender relation is loaded
        $this->message = [
            'id' => $message->id,
            'message' => $message->message,
            'sender_id' => $message->sender_id,
            'receiver_id' => $message->receiver_id,
            'sender_name' => $message->sender?->name,
            'created_at' => $message->created_at?->toDateTimeString(),
        ];
    }

    // canonical channel name: smallerId.biggerId so both users can subscribe to same channel
    protected function channelName(): string
    {
        $a = (int) $this->message['sender_id'];
        $b = (int) $this->message['receiver_id'];
        if ($a <= $b) {
            return "chat.{$a}.{$b}";
        }
        return "chat.{$b}.{$a}";
    }

    public function broadcastOn()
    {
        return [
            new PrivateChannel($this->channelName()),
        ];
    }

    public function broadcastAs(): string
    {
        return 'MessageSent';
    }
}

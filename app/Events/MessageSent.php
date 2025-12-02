<?php

namespace App\Events;

use App\Models\ChatMessage;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Queue\SerializesModels;

class MessageSent implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    /**
     * GANTI menjadi objek Message, bukan array.
     * Supaya Laravel otomatis membuat "amplop".
     * @var ChatMessage
     */
    public $message;

    public function __construct(ChatMessage $message)
    {
        $this->message = $message->load('sender');
    }

    public function broadcastOn(): array
    {
        $userIds = [$this->message->sender_id, $this->message->receiver_id];
        sort($userIds);

        return [
            new PresenceChannel('chat.' . $userIds[0] . '.' . $userIds[1]),
            
            new PrivateChannel('notifications.' . $this->message->receiver_id),
        ];
    }

    public function broadcastAs(): string
    {
        return 'MessageSent';
    }
}
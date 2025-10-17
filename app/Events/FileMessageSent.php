<?php

namespace App\Events;

use App\Models\ChatMessage;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Queue\SerializesModels;

class FileMessageSent implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    /**
     * Objek pesan yang berisi detail file.
     * @var ChatMessage
     */
    public $message;

    /**
     * Create a new event instance.
     *
     * @param ChatMessage $message
     */
    public function __construct(ChatMessage $message)
    {
        $this->message = $message->load('sender');
    }

    /**
     * Get the channels the event should broadcast on.
     *
     * @return array
     */
    public function broadcastOn(): array
    {
        $userIds = [$this->message->sender_id, $this->message->receiver_id];
        sort($userIds);

        return [
            new PresenceChannel('chat.' . $userIds[0] . '.' . $userIds[1]),
            
            new PrivateChannel('notifications.' . $this->message->receiver_id),
        ];
    }

    /**
     * Nama event yang akan didengarkan oleh Echo di frontend.
     *
     * @return string
     */
    public function broadcastAs(): string
    {
        return 'FileMessageSent';
    }
}
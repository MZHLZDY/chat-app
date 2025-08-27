<?php

namespace App\Events;

use App\Models\ChatMessage; // Pastikan jeneng model e bener
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Broadcasting\PrivateChannel; // <-- WAJIB DI-IMPORT
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Queue\SerializesModels;

class MessageSent implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    /**
     * GANTI dadi objek Message, guduk array.
     * Iki ben Laravel otomatis nggawe "amplop".
     * @var ChatMessage
     */
    public $message;

    public function __construct(ChatMessage $message)
    {
        // Cukup simpen objek asline, gak perlu digawe array manual
        $this->message = $message->load('sender');
    }

    /**
     * Siaran nang LORO channel.
     */
    public function broadcastOn(): array // <-- WAJIB array
    {
        // Urutno ID ne ben podo karo frontend
        $userIds = [$this->message->sender_id, $this->message->receiver_id];
        sort($userIds);

        return [
            // #1: Channel gawe live chat (wes bener)
            new PresenceChannel('chat.' . $userIds[0] . '.' . $userIds[1]),
            
            // #2: Channel "pager" gawe notifikasi unread (IKI SING PENTING)
            new PrivateChannel('notifications.' . $this->message->receiver_id),
        ];
    }

    public function broadcastAs(): string
    {
        return 'MessageSent';
    }
}
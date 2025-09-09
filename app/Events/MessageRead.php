<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class MessageRead implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $readerId;
    public $messageOwnerId;

    public function __construct(int $readerId, int $messageOwnerId)
    {
        $this->readerId = $readerId;
        $this->messageOwnerId = $messageOwnerId;
    }

    /**
     * Get the channels the event should broadcast on.
     *
     * 2. UBAH RETURN TYPE MENJADI PrivateChannel ATAU BUNGKUS DALAM ARRAY
     * @return \Illuminate\Broadcasting\PrivateChannel
     */
    public function broadcastOn(): PrivateChannel
    {
        // Langsung return object-nya dan sesuaikan return type hint
        return new PrivateChannel('notifications.' . $this->messageOwnerId);
    }

    /**
     * 3. TAMBAHKAN RETURN TYPE (Good Practice)
     */
    public function broadcastAs(): string
    {
        return 'MessageRead';
    }
}
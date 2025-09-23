<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;
use App\Models\User;

class CallAccepted implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public int $callerId,
        public User $callee,
        public string $channel,
        public string $callId
    ) {}

    public function broadcastOn(): array
    {
        return [
            new PrivateChannel('user.' . $this->callerId),
            new PrivateChannel('user.' . $this->callee->id),
        ];
    }

    public function broadcastAs(): string
    {
        return 'call-accepted';
    }

    public function broadcastWith(): array
    {
        // ✅ HINDARI QUERY DATABASE DI EVENT - Kirim data yang sudah ada
        return [
            'call_id' => $this->callId,
            'caller' => [
                'id' => $this->callerId,
                // Nama caller harus dikirim dari controller, bukan query di sini
                'name' => $this->callerId // Ini akan diperbaiki di controller
            ],
            'callee' => [
                'id' => $this->callee->id,
                'name' => $this->callee->name,
                // HAPUS email karena tidak diperlukan untuk call UI
            ],
            'channel' => $this->channel,
            'timestamp' => now()->toISOString()
        ];
    }
}
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
        public string $callId // UBAH DARI int MENJADI string JIKA PERLU
    ) {}

    public function broadcastOn(): array
{
    // Kirim ke caller DAN callee
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
        return [
            'call_id' => $this->callId,
            'caller' => [
              'id' => $this->callerId,
              'name' => User::find($this->callerId)->name // atau gunakan approach yang sama
            ],
            'callee' => [
                'id' => $this->callee->id,
                'name' => $this->callee->name,
                'email' => $this->callee->email
            ],
            'channel' => $this->channel,
            'timestamp' => now()->toISOString()
        ];
    }
}

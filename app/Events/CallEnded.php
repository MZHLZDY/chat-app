<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;
use App\Models\User; // ✅ TAMBAHKIN IMPORT

class CallEnded implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
      public string $channel,
      public array $participantIds,
      public int $endedBy,
      public string $endedByName, 
      public ?string $reason = null
    ) {}

    public function broadcastOn(): array
    {
        $channels = [];
        foreach ($this->participantIds as $participantId) {
            $channels[] = new PrivateChannel('user.' . $participantId);
        }
        return $channels;
    }

    public function broadcastAs(): string
    {
        return 'call-ended';
    }

    public function broadcastWith(): array
{
    return [
        'channel' => $this->channel,
        'ended_by' => [
            'id' => $this->endedBy,
            'name' => $this->endedByName 
        ],
        'reason' => $this->reason,
        'timestamp' => now()->toISOString()
    ];
}
}

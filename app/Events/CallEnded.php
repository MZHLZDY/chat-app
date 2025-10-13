<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel; // <-- Jangan lupa tambahkan ini
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class CallEnded implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    // Hapus properti $channel yang tidak lagi diperlukan
    public array $participantIds;
    public string $callId;
    public int $endedBy;
    public string $endedByName;
    public ?string $reason;
    public int $duration;
    public string $callType;

    // Sesuaikan constructor agar lebih rapi
    public function __construct(string $callId, array $participantIds, int $endedBy, string $endedByName, ?string $reason, int $duration, string $callType)
    {
        $this->callId = $callId;
        $this->participantIds = $participantIds;
        $this->endedBy = $endedBy;
        $this->endedByName = $endedByName;
        $this->reason = $reason;
        $this->duration = $duration;
        $this->callType = $callType;
    }

    /**
     * Get the channels the event should broadcast on.
     *
     * @return array<int, \Illuminate\Broadcasting\Channel>
     */
    public function broadcastOn(): array
    {
        $channels = [];
        
        // ✅ Loop melalui semua ID peserta dan buat PrivateChannel untuk masing-masing
        foreach ($this->participantIds as $userId) {
            $channels[] = new PrivateChannel('user.' . $userId);
        }
        
        return $channels;
    }

    public function broadcastAs(): string
    {
        return 'voice-call-ended';
    }
}
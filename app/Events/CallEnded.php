<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class CallEnded implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $channel;
    public $participantIds;
    public $endedBy;

    public function __construct(string $channel, array $participantIds, int $endedBy = null)
    {
        $this->channel = $channel;
        $this->participantIds = $participantIds;
        $this->endedBy = $endedBy;
    }

    public function broadcastOn()
    {
        // Broadcast ke semua peserta panggilan
        return array_map(function ($userId) {
            return new Channel('user.' . $userId);
        }, $this->participantIds);
    }

    public function broadcastWith()
    {
        return [
            'channel' => $this->channel,
            'ended_by' => $this->endedBy,
            'timestamp' => now()->toDateTimeString()
        ];
    }

    public function broadcastAs()
    {
        return 'call-ended';
    }
}

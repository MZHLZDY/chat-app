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

    public function __construct(
        public string $channel,
        public array $participantIds,
        public int $endedBy
    ) {}

    public function broadcastOn(): array
    {
        return array_map(function ($userId) {
            return new PrivateChannel('user.' . $userId);
        }, $this->participantIds);
    }

    public function broadcastAs(): string
    {
        return 'call-ended';
    }

    public function broadcastWith(): array
    {
        return [
            'channel' => $this->channel,
            'participant_ids' => $this->participantIds,
            'ended_by' => $this->endedBy,
            'reason' => 'Call ended by user',
        ];
    }
}
<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;
use App\Models\ChatMessage;

class CallEnded implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $callId;
    public $participantIds;
    public $endedBy;
    public $endedByName;
    public $reason;
    public $duration;
    public $callType;
    public $message; // ✅ Tambahkan property message

    public function __construct(
        string $callId,
        array $participantIds,
        int $endedBy,
        string $endedByName,
        ?string $reason = null,
        int $duration = 0,
        string $callType = 'voice',
        ?ChatMessage $message = null // ✅ Tambahkan parameter message
    ) {
        $this->callId = $callId;
        $this->participantIds = $participantIds;
        $this->endedBy = $endedBy;
        $this->endedByName = $endedByName;
        $this->reason = $reason;
        $this->duration = $duration;
        $this->callType = $callType;
        $this->message = $message; // ✅ Set message
    }

    public function broadcastOn(): array
    {
        return array_map(
            fn($id) => new PrivateChannel('user.' . $id),
            $this->participantIds
        );
    }

    public function broadcastAs(): string
    {
        return 'voice-call-ended';
    }

    // ✅ PERBAIKAN: Sertakan message dalam broadcast data
    public function broadcastWith(): array
    {
        return [
            'call_id' => $this->callId,
            'ended_by' => [
                'id' => $this->endedBy,
                'name' => $this->endedByName
            ],
            'reason' => $this->reason,
            'duration' => $this->duration,
            'call_type' => $this->callType,
            'message' => $this->message ? [
                'id' => $this->message->id,
                'message' => $this->message->message,
                'type' => $this->message->type,
                'call_event' => $this->message->callEvent,
                'created_at' => $this->message->created_at,
                'sender_id' => $this->message->sender_id,
                'receiver_id' => $this->message->receiver_id,
            ] : null
        ];
    }
}
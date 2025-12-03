<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;
use App\Models\User;

class GroupCallEnded implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $userId;
    public $groupId;
    public $callId;
    public $reason;
    public $duration;
    public $memberIds;
    public $endedBy;

    // ✅ PERBAIKAN: Tambahkan parameter $endedBy ke constructor
    public function __construct($userId, $groupId, $callId, $reason = 'ended', $duration = 0, $memberIds = [], $endedBy = null)
    {
        $this->userId = $userId;
        $this->groupId = $groupId;
        $this->callId = $callId;
        $this->reason = $reason;
        $this->duration = $duration;
        $this->memberIds = $memberIds;
        $this->endedBy = $endedBy ?: User::find($userId);
    }

    public function broadcastOn(): array
    {
        $channels = [];

        // broadcast ke semua member individual
        foreach ($this->memberIds as $memberId) {
            $channels[] = new Channel('user.' . $memberId);
        }

        // ✅ OPSIONAL: Juga broadcast ke group channel
        $channels[] = new Channel('group.' . $this->groupId);

        return $channels;
    }

    public function broadcastAs(): string
    {
        return 'group-call-ended';
    }

    public function broadcastWith(): array
    {
        // ✅ PASTIKAN $this->endedBy adalah objek User
        $endedByData = $this->endedBy instanceof User ? [
            'id' => $this->endedBy->id,
            'name' => $this->endedBy->name,
            'profile_photo_url' => $this->endedBy->profile_photo_url
        ] : [
            'id' => $this->userId,
            'name' => 'Host',
            'profile_photo_url' => null
        ];

        return [
            'call_id' => $this->callId,
            'group_id' => $this->groupId,
            'reason' => $this->reason,
            'duration' => $this->duration,
            'ended_by' => $endedByData
        ];
    }
}
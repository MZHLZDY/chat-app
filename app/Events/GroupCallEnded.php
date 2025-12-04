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

    /**
     * Constructor sederhana
     * Parameter ke-7 ($endedBy) opsional untuk kompatibilitas
     */
    public function __construct($userId, $groupId, $callId, $reason = 'ended', $duration = 0, $memberIds = [], $endedBy = null)
    {
        $this->userId = $userId;
        $this->groupId = $groupId;
        $this->callId = $callId;
        $this->reason = $reason;
        $this->duration = $duration;
        $this->memberIds = $memberIds;
        
        // Jika $endedBy tidak dikirim, cari user berdasarkan userId
        $this->endedBy = $endedBy ?: User::find($userId);
        
        \Log::info('🎯 [GROUP CALL ENDED EVENT] Created', [
            'call_id' => $this->callId,
            'ended_by_id' => $this->endedBy->id ?? $userId,
            'member_count' => count($this->memberIds)
        ]);
    }

    /**
     * Broadcast ke masing-masing user channel
     */
    public function broadcastOn(): array
    {
        return [
            new PrivateChannel('group.' . $this->groupCall->group_id),
        ];
    }

    /**
     * Nama event
     */
    public function broadcastAs(): string
    {
        return 'group-call-ended';
    }

    /**
     * Data yang dikirim ke frontend
     * SEDERHANA: hanya data yang diperlukan untuk alert
     */
    public function broadcastWith(): array
    {
        // Siapkan data ended_by
        $endedByData = [];
        
        if ($this->endedBy instanceof User) {
            $endedByData = [
                'id' => $this->endedBy->id,
                'name' => $this->endedBy->name,
                'profile_photo_url' => $this->endedBy->profile_photo_url
            ];
        } else {
            // Fallback jika tidak ada data user
            $endedByData = [
                'id' => $this->userId,
                'name' => 'Host',
                'profile_photo_url' => null
            ];
        }

        // Data SEDERHANA yang dikirim ke frontend
        return [
            'call_id' => $this->callId,
            'group_id' => $this->groupId,
            'reason' => $this->reason,
            'duration' => $this->duration,
            'ended_by' => $endedByData
        ];
    }
}
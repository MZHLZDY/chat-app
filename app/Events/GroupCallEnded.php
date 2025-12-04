<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
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
            'group_id' => $this->groupId,
            'ended_by_id' => $this->endedBy->id ?? $userId,
            'member_ids' => $this->memberIds,
            'member_count' => count($this->memberIds),
            'reason' => $this->reason
        ]);
    }

    /**
     * Broadcast ke masing-masing user channel
     */
    public function broadcastOn(): array
    {
        $channels = [];
        
        // ✅ PERBAIKAN: Pastikan semua member mendapat event
        foreach ($this->memberIds as $memberId) {
            $channels[] = new PrivateChannel('user.' . $memberId);
        }
        
        // ✅ PERBAIKAN: Tambahkan host juga jika belum termasuk
        if (!in_array($this->userId, $this->memberIds)) {
            $channels[] = new PrivateChannel('user.' . $this->userId);
            \Log::info('➕ [GROUP CALL ENDED] Added host channel:', ['host_id' => $this->userId]);
        }
        
        \Log::info('📡 [GROUP CALL ENDED] Broadcasting to channels:', [
            'total_channels' => count($channels),
            'member_ids' => $this->memberIds,
            'host_id' => $this->userId,
            'all_channels' => array_map(function($channel) {
                return $channel->name;
            }, $channels)
        ]);
        
        return $channels;
    }

    /**
     * Nama event - HARUS SESUAI DENGAN FRONTEND
     */
    public function broadcastAs(): string
    {
        // ✅ PERBAIKAN: Gunakan format dengan titik di depan
        return 'group-call-ended';
    }

    /**
     * Data yang dikirim ke frontend
     */
    public function broadcastWith(): array
    {
        // Siapkan data ended_by
        $endedByData = [];
        
        if ($this->endedBy instanceof User) {
            $endedByData = [
                'id' => $this->endedBy->id,
                'name' => $this->endedBy->name,
                'profile_photo_url' => $this->endedBy->profile_photo_url ?? null
            ];
        } else {
            // Fallback jika tidak ada data user
            $endedByData = [
                'id' => $this->userId,
                'name' => 'Host',
                'profile_photo_url' => null
            ];
        }

        return [
            'call_id' => $this->callId,
            'group_id' => $this->groupId,
            'reason' => $this->reason,
            'duration' => $this->duration,
            'ended_by' => $endedByData,
            'timestamp' => now()->toISOString(),
            'event_type' => 'group_call_ended'
        ];
    }
}
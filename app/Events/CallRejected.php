<?php
// app/Events/CallRejected.php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class CallRejected implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $callId;
    public $callerId;
    public $reason;
    public $calleeId;
    public $callType;
    public $message;
    public $rejected_by;

    public function __construct($callId, $callerId, $reason, $calleeId, $callType, $message = null)
    {
        $this->callId = $callId;
        $this->callerId = $callerId;
        $this->reason = $reason;
        $this->calleeId = $calleeId;
        $this->callType = $callType;
        $this->message = $message;
        
        // ✅ PASTIKAN DATA rejected_by ADA
        $this->rejected_by = [
            'id' => $calleeId,
            'name' => \App\Models\User::find($calleeId)->name ?? 'Unknown User'
        ];
    }

    public function broadcastOn()
    {
        // ✅ PASTIKAN BROADCAST KE CHANNEL YANG BENAR
        return new PrivateChannel('user.' . $this->callerId);
    }

    public function broadcastAs()
    {
        return 'call-rejected';
    }

    // ✅ PASTIKAN DATA TERKIRIM DENGAN FORMAT YANG KONSISTEN
    public function broadcastWith()
    {
        return [
            'call_id' => $this->callId,
            'caller_id' => $this->callerId,
            'reason' => $this->reason,
            'callee_id' => $this->calleeId,
            'call_type' => $this->callType,
            'rejected_by' => $this->rejected_by,
            'message' => $this->message,
            'timestamp' => now()->toISOString()
        ];
    }
}
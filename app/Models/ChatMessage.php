<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use App\Models\HiddenMessage;

class ChatMessage extends Model
{
    use HasFactory, SoftDeletes;
    
    protected $fillable = [
        "sender_id", 
        "receiver_id", 
        "group_id",
        "message", 
        'type', 
        'file_path', 
        'file_name', 
        'file_mime_type', 
        'file_size',
        'call_data' // ✅ BARU: Menyimpan data call dalam JSON
    ];

    protected $casts = [
        'created_at' => 'datetime',
        'call_data' => 'array', // ✅ BARU: Auto cast JSON ke array
    ];

    public function sender(): BelongsTo
    {
        return $this->belongsTo(User::class, "sender_id");
    }

    public function receiver(): BelongsTo
    {
        return $this->belongsTo(User::class, "receiver_id");
    }

    public function hiddenForUsers()
    {
        return $this->morphMany(HiddenMessage::class, 'message');
    }

    public function parentMessage()
    {
        return $this->belongsTo(self::class, 'reply_to_message_id');
    }

    /**
     * ✅ BARU: Generate text untuk pesan call berdasarkan call_data
     */
    public function getCallMessageText(): string
    {
        if ($this->type !== 'call_event' || !$this->call_data) {
            return $this->message;
        }

        $callData = $this->call_data;
        $text = ($callData['call_type'] ?? 'voice') === 'video' ? 'Panggilan Video' : 'Panggilan Suara';

        switch ($callData['status'] ?? 'unknown') {
            case 'calling':   
                $text .= ' • Memanggil'; 
                break;
            case 'cancelled': 
                $text .= ' • Dibatalkan'; 
                break;
            case 'rejected':  
                $text .= ' • Ditolak';
                if (!empty($callData['reason']) && $callData['reason'] !== 'Ditolak') {
                    $text .= ' - ' . $callData['reason'];
                }
                break;
            case 'missed':    
                $text .= ' • Tak terjawab'; 
                break;
            case 'accepted':  
                $text .= ' • Diterima'; 
                break;
            case 'ended':
                if (!empty($callData['duration']) && $callData['duration'] > 0) {
                    $text .= ' • ' . $this->formatCallDuration($callData['duration']);
                } else {
                    $text .= ' • Selesai';
                }
                break;
            default:
                $text .= ' • Selesai';
        }

        return $text;
    }

    /**
     * ✅ BARU: Format durasi panggilan
     */
    private function formatCallDuration($seconds): string
    {
        if ($seconds < 60) {
            return "{$seconds} dtk";
        }
        
        $minutes = floor($seconds / 60);
        $remainingSeconds = $seconds % 60;
        
        if ($minutes < 60) {
            return $remainingSeconds > 0 
                ? "{$minutes} mnt {$remainingSeconds} dtk" 
                : "{$minutes} mnt";
        }
        
        $hours = floor($minutes / 60);
        $remainingMinutes = $minutes % 60;
        
        return $remainingMinutes > 0 
            ? "{$hours} jam {$remainingMinutes} mnt" 
            : "{$hours} jam";
    }

    /**
     * ✅ BARU: Update call data
     */
    public function updateCallData(array $data): void
    {
        $currentData = $this->call_data ?? [];
        $this->call_data = array_merge($currentData, $data);
        
        // Update message text otomatis
        $this->message = $this->getCallMessageText();
        $this->save();
    }

    /**
     * ✅ BARU: Scope untuk filter call messages
     */
    public function scopeCallEvents($query)
    {
        return $query->where('type', 'call_event');
    }

    /**
     * ✅ BARU: Scope untuk filter berdasarkan call_id
     */
    public function scopeByCallId($query, string $callId)
    {
        return $query->where('type', 'call_event')
                     ->whereJsonContains('call_data->call_id', $callId);
    }

    /**
     * ✅ BARU: Accessor untuk mendapatkan call_event yang kompatibel dengan frontend
     */
    public function getCallEventAttribute()
    {
        if ($this->type !== 'call_event' || !$this->call_data) {
            return null;
        }

        return [
            'status' => $this->call_data['status'] ?? null,
            'call_type' => $this->call_data['call_type'] ?? 'voice',
            'duration' => $this->call_data['duration'] ?? null,
            'reason' => $this->call_data['reason'] ?? null,
            'call_id' => $this->call_data['call_id'] ?? null,
            'channel' => $this->call_data['channel'] ?? null,
            'temp' => false
        ];
    }
}
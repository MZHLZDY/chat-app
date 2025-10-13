<?php
// file: app/Models/CallEvent.php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class CallEvent extends Model
{
    use HasFactory;

    protected $fillable = [
        'caller_id',
        'callee_id',
        'channel',
        'status',
        'duration',
        'call_type',
        'reason',
    ];

    // Method untuk menerjemahkan status menjadi teks yang ramah pengguna
    public function getCallMessageText(): string
    {
        $text = $this->call_type === 'video' ? 'Panggilan Video' : 'Panggilan Suara';

        switch ($this->status) {
            case 'calling':   $text .= ' • Memanggil'; break;
            case 'accepted':  $text .= ' • Diterima'; break;
            case 'rejected':  $text .= ' • Ditolak' . ($this->reason ? " - {$this->reason}" : ''); break;
            case 'cancelled': $text .= ' • Dibatalkan'; break;
            case 'missed':    $text .= ' • Tak terjawab'; break;
            case 'ended':
                // Menggunakan helper formatDuration dari controller
                $durationText = app(\App\Http\Controllers\AgoraCallController::class)->formatDurationForPublic($this->duration);
                $text .= $this->duration > 0 ? ' • ' . $durationText : ' • Selesai';
                break;
            default:
                $text .= ' • Selesai';
        }

        return $text;
    }
}
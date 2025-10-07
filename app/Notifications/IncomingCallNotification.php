<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;
use Illuminate\Notifications\Messages\BroadcastMessage;
use NotificationChannels\WebPush\WebPushChannel;
use NotificationChannels\WebPush\WebPushMessage;

class IncomingCallNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public $callData;
    public $callType;

    public function __construct($callData, $callType = 'personal')
    {
        $this->callData = $callData;
        $this->callType = $callType;
    }

    public function via($notifiable)
    {
        // Sekarang kita kirim melalui 3 channel: broadcast (Echo), database, dan webpush
        return ['broadcast', 'database', WebPushChannel::class];
    }

    public function toBroadcast($notifiable)
    {
        // Fungsi ini tetap sama, untuk notifikasi real-time saat tab aktif
        return new BroadcastMessage([
            'call_id' => $this->callData['call_id'],
            'caller' => $this->callData['caller'],
            'call_type' => $this->callType,
            'channel' => $this->callData['channel'],
            'group' => $this->callData['group'] ?? null,
            'timestamp' => now()->toISOString(),
            'type' => $this->callType === 'group' ? 'group-incoming-call' : 'incoming-call'
        ]);
    }

    // 👇 FUNGSI BARU UNTUK MENGIRIM PUSH NOTIFICATION
    public function toWebPush($notifiable)
    {
        $isGroupCall = $this->callType === 'group';
        $title = $isGroupCall ? 'Panggilan Grup Masuk' : 'Panggilan Suara Masuk';
        $body = $isGroupCall
            ? "{$this->callData['caller']['name']} mengundang Anda ke grup: {$this->callData['group']['name']}"
            : "{$this->callData['caller']['name']} sedang menelpon Anda";
        $tag = $isGroupCall ? "group-call-{$this->callData['call_id']}" : "call-{$this->callData['call_id']}";
        $acceptTitle = $isGroupCall ? 'Gabung' : 'Terima';

        return (new WebPushMessage)
            ->title($title)
            ->body($body)
            ->icon('/images/phone-icon.png')
            ->badge('/images/badge-72x72.png')
            ->options([
                'tag' => $tag,
                'requireInteraction' => true, // Notifikasi tidak akan hilang sampai diinteraksi
            ])
            ->actions([
                ['action' => 'accept', 'title' => "✅ {$acceptTitle}"],
                ['action' => 'reject', 'title' => '❌ Tolak'],
            ])
            ->data([
                'callId' => $this->callData['call_id'],
                'callType' => $this->callType,
                'channel' => $this->callData['channel'],
                'url' => url('/chat'), // URL yang akan dibuka jika notifikasi diklik
            ]);
    }

    public function toArray($notifiable)
    {
        return [
            'call_id' => $this->callData['call_id'],
            'caller_id' => $this->callData['caller']['id'],
            'caller_name' => $this->callData['caller']['name'],
            'call_type' => $this->callType,
            'channel' => $this->callData['channel'],
            'group_id' => $this->callData['group']['id'] ?? null,
            'group_name' => $this->callData['group']['name'] ?? null,
            'timestamp' => now()->toISOString(),
        ];
    }
}
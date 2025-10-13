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
        return ['database', 'broadcast', WebPushChannel::class];
    }

    public function toBroadcast($notifiable)
    {
        $isGroupCall = $this->callType === 'group';
        
        // ✅ DISESUAIKAN: Menggunakan key 'caller_id' dan 'caller_name'
        return new BroadcastMessage([
            'call_id' => $this->callData['call_id'],
            'caller' => [
                'id' => $this->callData['caller_id'],
                'name' => $this->callData['caller_name']
            ],
            'call_type' => $this->callType,
            'channel' => $this->callData['channel'],
            'group' => $isGroupCall ? ($this->callData['group'] ?? null) : null,
            'timestamp' => $this->callData['timestamp'] ?? now()->toISOString(),
            'type' => $isGroupCall ? 'group-incoming-call' : 'incoming-call'
        ]);
    }
    
    public function toWebPush($notifiable)
    {
        $isGroupCall = $this->callType === 'group';
        $title = $isGroupCall ? 'Panggilan Grup Masuk' : 'Panggilan Suara Masuk';
        // ✅ DISESUAIKAN: Menggunakan 'caller_name'
        $body = $isGroupCall
            ? "{$this->callData['caller_name']} mengundang Anda ke grup: " . ($this->callData['group']['name'] ?? '')
            : "{$this->callData['caller_name']} sedang menelpon Anda";
        
        $tag = "call-{$this->callData['call_id']}";
        $acceptTitle = $isGroupCall ? 'Gabung' : 'Terima';

        return (new WebPushMessage)
            ->title($title)
            ->body($body)
            ->icon('/images/phone-icon.png')
            ->badge('/images/badge-72x72.png')
            ->options(['tag' => $tag, 'requireInteraction' => true])
            ->actions([
                ['action' => 'accept', 'title' => "✅ {$acceptTitle}"],
                ['action' => 'reject', 'title' => '❌ Tolak'],
            ])
            // ✅ DISESUAIKAN: Menggunakan 'caller_name'
            ->data([
                'callId' => $this->callData['call_id'],
                'callType' => $this->callType,
                'channel' => $this->callData['channel'],
                'callerName' => $this->callData['caller_name'],
                'groupId' => $isGroupCall ? ($this->callData['group']['id'] ?? null) : null,
                'groupName' => $isGroupCall ? ($this->callData['group']['name'] ?? null) : null,
                'url' => url('/chat'),
            ]);
    }

    public function toArray($notifiable)
    {
        // ✅ DISESUAIKAN: Menggunakan 'caller_id' dan 'caller_name'
        return [
            'call_id' => $this->callData['call_id'],
            'caller_id' => $this->callData['caller_id'],
            'caller_name' => $this->callData['caller_name'],
            'call_type' => $this->callType,
            'channel' => $this->callData['channel'],
            'group_id' => $this->callType === 'group' ? ($this->callData['group']['id'] ?? null) : null,
            'group_name' => $this->callType === 'group' ? ($this->callData['group']['name'] ?? null) : null,
            'timestamp' => $this->callData['timestamp'] ?? now()->toISOString(),
        ];
    }

    public function toDatabase($notifiable)
    {
        return $this->toArray($notifiable);
    }
}
<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;
use Illuminate\Notifications\Messages\BroadcastMessage;

class IncomingCallNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public $callData;
    public $callType;

    const TYPE_PERSONAL = 'personal';
    const TYPE_GROUP = 'group';

    public function __construct($callData, $callType = 'personal')
    {
        $this->callData = $callData;
        $this->callType = $callType;
    }

    public function via($notifiable)
    {
        return ['broadcast', 'database'];
    }

    public function toBroadcast($notifiable)
    {
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
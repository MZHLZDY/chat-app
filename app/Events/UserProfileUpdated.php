<?php

namespace App\Events;

use App\Models\User;
use App\Models\ChatMessage;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class UserProfileUpdated implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $user;

    public function __construct(User $user)
    {
        $this->user = $user;
    }

    public function broadcastWith(): array
    {
        return [
            'user' => [
                'id' => $this->user->id,
                'name' => $this->user->name,
                'profile_photo_url' => $this->user->profile_photo_url,
            ]
        ];
    }

    public function broadcastOn(): array
    {
        $userId = $this->user->id;

        $senderIds = ChatMessage::where('receiver_id', $userId)->distinct()->pluck('sender_id');
        $receiverIds = ChatMessage::where('sender_id', $userId)->distinct()->pluck('receiver_id');
        $allContactIds = $senderIds->merge($receiverIds)->unique();
        
        $channels = [];
        foreach ($allContactIds as $contactId) {
            $channelName = 'chat.' . min($userId, $contactId) . '.' . max($userId, $contactId);
            $channels[] = new PrivateChannel($channelName);
        }

        $channels[] = new PrivateChannel('user.' . $this->user->id); 

        return $channels;
    }

    public function broadcastAs(): string
    {
        return 'UserProfileUpdated';
    }
}
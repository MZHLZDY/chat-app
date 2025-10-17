<?php

namespace App\Events;

use App\Models\User;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class NewWebRTCIceCandidate implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public User $sender;
    public User $target;
    public array $candidate;

    /**
     * Create a new event instance.
     */
    public function __construct(User $sender, User $target, array $candidate)
    {
        $this->sender = $sender;
        $this->target = $target;
        $this->candidate = $candidate;
    }

    /**
     * Get the channels the event should broadcast on.
     */
    public function broadcastOn(): array
    {
        // Broadcast to the private channel of the target user.
        return [
            new PrivateChannel('user.' . $this->target->id),
        ];
    }

    /**
     * The event's broadcast name.
     */
    public function broadcastAs(): string
    {
        return 'new-webrtc-ice-candidate';
    }

    /**
     * Get the data to broadcast.
     */
    public function broadcastWith(): array
    {
        return [
            'sender' => [
                'id' => $this->sender->id,
            ],
            'candidate' => $this->candidate,
        ];
    }
}
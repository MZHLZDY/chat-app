<?php

namespace App\Events;

use App\Models\User;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class WebRTCOfferReceived implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public User $caller;
    public User $callee;
    public array $offer;

    /**
     * Create a new event instance.
     */
    public function __construct(User $caller, User $callee, array $offer)
    {
        $this->caller = $caller;
        $this->callee = $callee;
        $this->offer = $offer;
    }

    /**
     * Get the channels the event should broadcast on.
     */
    public function broadcastOn(): array
    {
        // Broadcast to the private channel of the user receiving the call (callee).
        return [
            new PrivateChannel('user.' . $this->callee->id),
        ];
    }

    /**
     * The event's broadcast name.
     */
    public function broadcastAs(): string
    {
        return 'webrtc-offer-received';
    }

    /**
     * Get the data to broadcast.
     */
    public function broadcastWith(): array
    {
        return [
            'caller' => [
                'id' => $this->caller->id,
                'name' => $this->caller->name,
            ],
            'offer' => $this->offer,
        ];
    }
}
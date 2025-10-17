<?php

namespace App\Events;

use App\Models\User;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class WebRTCAnswerReceived implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public User $caller;
    public User $callee;
    public array $answer;

    /**
     * Create a new event instance.
     */
    public function __construct(User $caller, User $callee, array $answer)
    {
        $this->caller = $caller;
        $this->callee = $callee;
        $this->answer = $answer;
    }

    /**
     * Get the channels the event should broadcast on.
     */
    public function broadcastOn(): array
    {
        // Broadcast back to the private channel of the original caller.
        return [
            new PrivateChannel('user.' . $this->caller->id),
        ];
    }

    /**
     * The event's broadcast name.
     */
    public function broadcastAs(): string
    {
        return 'webrtc-answer-received';
    }

    /**
     * Get the data to broadcast.
     */
    public function broadcastWith(): array
    {
        return [
            'callee' => [
                'id' => $this->callee->id,
                'name' => $this->callee->name,
            ],
            'answer' => $this->answer,
        ];
    }
}
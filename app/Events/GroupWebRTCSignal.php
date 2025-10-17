<?php

namespace App\Events;

use App\Models\User;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class GroupWebRTCSignal implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public array $payload;
    public User $target;

    /**
     * Create a new event instance.
     *
     * @param array $payload Data sinyal (berisi group_id, sender_id, signal_type, signal_data)
     * @param User $target Pengguna yang akan menerima sinyal ini
     */
    public function __construct(array $payload, User $target)
    {
        $this->payload = $payload;
        $this->target = $target;
    }

    /**
     * Get the channels the event should broadcast on.
     */
    public function broadcastOn(): array
    {
        // Kirim sinyal ke channel privat milik pengguna target
        return [
            new PrivateChannel('user.' . $this->target->id),
        ];
    }

    /**
     * The event's broadcast name.
     */
    public function broadcastAs(): string
    {
        // Nama event yang akan didengarkan oleh frontend (Echo)
        return 'group-webrtc-signal';
    }

    /**
     * Get the data to broadcast.
     */
    public function broadcastWith(): array
    {
        // Langsung kirim seluruh payload
        return $this->payload;
    }
}
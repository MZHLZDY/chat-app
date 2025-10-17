<?php

namespace App\Events;

use App\Models\User;
use App\Models\Group;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class GroupCallInvitation implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public User $caller;
    public User $callee;
    public Group $group;

    /**
     * Create a new event instance.
     */
    public function __construct(User $caller, User $callee, Group $group)
    {
        $this->caller = $caller;
        $this->callee = $callee;
        $this->group = $group;
    }

    /**
     * Get the channels the event should broadcast on.
     */
    public function broadcastOn(): array
    {
        // Kirim undangan ke channel privat milik setiap anggota grup (callee)
        return [
            new PrivateChannel('user.' . $this->callee->id),
        ];
    }

    /**
     * The event's broadcast name.
     */
    public function broadcastAs(): string
    {
        // Nama event yang akan didengarkan oleh frontend (Echo)
        return 'group-call-invitation';
    }

    /**
     * Get the data to broadcast.
     */
    public function broadcastWith(): array
    {
        // Data yang dikirim ke frontend
        return [
            'group' => [
                'id' => $this->group->id,
                'name' => $this->group->name,
            ],
            'caller' => [
                'id' => $this->caller->id,
                'name' => $this->caller->name,
            ],
        ];
    }
}
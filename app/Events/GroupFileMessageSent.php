<?php

namespace App\Events;

use App\Models\GroupMessage;
use App\Models\User;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;
use Illuminate\Broadcasting\InteractsWithSockets;

class GroupFileMessageSent implements ShouldBroadcastNOw
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    /**
     * Objek pesan grup yang berisi detail file.
     * @var GroupMessage
     */
    public $message;

    /**
     * Create a new event instance.
     *
     * @param GroupMessage $message
     */
    public function __construct(GroupMessage $message)
    {
        $this->message = $message->load('sender');
    }

    /**
     * Get the channels the event should broadcast on.
     *
     * @return array
     */
    public function broadcastOn(): array
    {
        $memberChannels = $this->message->group->members->map(function (User $member) {
            return new PrivateChannel('notifications.' . $member->id);
        })->all();

        return array_merge(
            [new PresenceChannel('group.' . $this->message->group_id)],
            $memberChannels
        );
    }

    /**
     * Nama event yang akan didengarkan oleh Echo di frontend.
     *
     * @return string
     */
    public function broadcastAs(): string
    {
        return 'GroupFileMessageSent';
    }
}
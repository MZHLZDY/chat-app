<?php

namespace App\Events;

use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;
use App\Models\User;
use App\Models\Group;

class GroupIncomingCallVoice implements ShouldBroadcast
{
    use Dispatchable, SerializesModels;

    public function __construct(
      public string $callId,
      public Group $group,
      public User $caller,
      public string $callType,
      public string $channel,
      public array $participants, // Daftar lengkap semua peserta
      public ?User $recalledUser = null
    ) {}

    public function broadcastOn(): array
    {
        // Jika ini panggilan ulang, kirim hanya ke satu user
        if ($this->recalledUser) {
            return [ new PrivateChannel('user.' . $this->recalledUser->id) ];
        }

        $channels = [];
        
        // Kirim ke SEMUA peserta termasuk HOST
        foreach ($this->participants as $participant) {
            if (isset($participant['id'])) {
                $channels[] = new PrivateChannel('user.' . $participant['id']);
            }
        }

        return $channels;
    }

    public function broadcastAs(): string
    {
        return 'group-incoming-call';
    }

    public function broadcastWith(): array
    {
        return [
            'callId' => $this->callId,
            'group' => ['id' => $this->group->id, 'name' => $this->group->name],
            'caller' => ['id' => $this->caller->id, 'name' => $this->caller->name],
            'callType' => $this->callType,
            'channel' => $this->channel,
            'participants' => $this->participants
        ];
    }
}
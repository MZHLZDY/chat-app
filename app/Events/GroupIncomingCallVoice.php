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
        public array $participants,
        public ?User $recalledUser = null
    ) {}

    public function broadcastOn(): array
    {
        // Jika ini panggilan ulang, kirim hanya ke satu user
        if ($this->recalledUser) {
            return [ new PrivateChannel('user.' . $this->recalledUser->id) ];
        }

        // --- PERBAIKAN: LOGIKA MENJADI LEBIH SEDERHANA ---
        $channels = [];
        foreach ($this->participants as $participant) {
            // Siarkan HANYA jika ID peserta BUKAN ID penelepon
            if (isset($participant['id']) && $participant['id'] !== $this->caller->id) {
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
        // Data yang dikirim ke penerima tetap data yang lengkap
        return [
            'callId' => $this->callId,
            'group' => ['id' => $this->group->id, 'name' => $this->group->name],
            'caller' => ['id' => $this->caller->id, 'name' => $this->caller->name],
            'callType' => $this->callType,
            'channel' => $this->channel,
            'participants' => $this->participants // Kirim daftar lengkap
        ];
    }
}
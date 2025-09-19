<?php

namespace App\Events;

use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;
use App\Models\User;

class GroupCallCancelled implements ShouldBroadcast
{
    use Dispatchable, SerializesModels;

    /**
     * Create a new event instance.
     * Menggunakan PHP 8 Constructor Property Promotion.
     *
     * @param string $callId ID unik dari panggilan yang dibatalkan.
     * @param array $participantIds Array berisi ID semua pengguna yang diundang.
     * @param User $caller Objek pengguna yang membatalkan panggilan.
     * @return void
     */
    public function __construct(
        public string $callId,
        public array $participantIds,
        public User $caller
    ) {}

    /**
     * Get the channels the event should broadcast on.
     *
     * @return \Illuminate\Broadcasting\Channel|array
     */
    public function broadcastOn(): array
    {
        // Kirim event ini ke setiap peserta secara individual
        // di channel personal ("kotak surat") mereka masing-masing.
        $channels = [];
        foreach ($this->participantIds as $userId) {
            $channels[] = new PrivateChannel('user.' . $userId);
        }
        return $channels;
    }

    /**
     * The name of the event broadcast.
     * Ini adalah nama yang akan didengarkan oleh Laravel Echo di frontend.
     */
    public function broadcastAs(): string
    {
        return 'group-call-cancelled';
    }

    /**
     * Get the data to broadcast.
     * Ini adalah data yang akan diterima oleh frontend.
     *
     * @return array
     */
    public function broadcastWith(): array
    {
        return [
            'callId' => $this->callId,
            'caller' => [
                'id' => $this->caller->id,
                'name' => $this->caller->name,
            ]
        ];
    }
}
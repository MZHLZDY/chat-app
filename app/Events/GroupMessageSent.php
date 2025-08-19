<?php

namespace App\Events;

use App\Models\GroupMessage;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Queue\SerializesModels;

class GroupMessageSent implements ShouldBroadcast
{
    use SerializesModels;

    public function __construct(public GroupMessage $message) 
    {
        // Eager load relasi 'sender' agar datanya ikut terkirim
        $this->message->load('sender');
    }

    /**
     * Menentukan data spesifik yang akan di-broadcast.
     * Ini akan mengirimkan detail pengirim ke frontend.
     */
    public function broadcastWith(): array
    {
        return [
            'id' => $this->message->id,
            'group_id' => $this->message->group_id,
            'sender_id' => $this->message->sender_id,
            'message' => $this->message->message,
            'created_at' => $this->message->created_at->toDateTimeString(),
            'sender' => [
                'id' => $this->message->sender->id,
                'name' => $this->message->sender->name,
            ],
        ];
    }

    public function broadcastOn(): PrivateChannel
    {
        return new PrivateChannel('group.' . $this->message->group_id);
    }

    /**
     * Mengubah nama event agar lebih sesuai dengan frontend.
     * Frontend Anda listen ke '.GroupMessageSent' (dengan titik).
     * `broadcastAs` yang benar tidak menggunakan titik di depan.
     */
    public function broadcastAs(): string
    {
        return 'GroupMessageSent';
    }
}
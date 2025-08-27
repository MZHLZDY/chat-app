<?php

namespace App\Events;

use App\Models\GroupMessage; // Sesuaikan jeneng modelmu lek bedo
use App\Models\Group; // Import sisan
use App\Models\User; // Import sisan
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;
use Illuminate\Broadcasting\InteractsWithSockets;

class GroupMessageSent implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $message;

    public function __construct(GroupMessage $message)
    {
        // Ganti dadi objek, guduk array, ben konsisten
        $this->message = $message->load('sender');
    }

    /**
     * Nentukno channel-channel sing arep dienggo siaran.
     * Saiki de'e ngirim array, guduk siji channel tok.
     */
    public function broadcastOn(): array
    {
        // Gawe daftar channel "pager" gawe saben anggota grup
        $memberChannels = $this->message->group->members->map(function (User $member) {
            return new PrivateChannel('notifications.' . $member->id);
        })->all(); // ->all() gawe ngubah koleksi dadi array biasa

        // Gabungno channel utama grup karo daftar channel notifikasi anggota
        return array_merge(
            [new PrivateChannel('group.' . $this->message->group_id)],
            $memberChannels
        );
    }

    public function broadcastAs(): string
    {
        return 'GroupMessageSent';
    }
}
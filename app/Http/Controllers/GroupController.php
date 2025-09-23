<?php

namespace App\Http\Controllers;

use App\Events\GroupMessageSent;
use App\Models\Group;
use App\Models\GroupMessage;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;

class GroupController extends Controller
{
    public function index()
    {
        $groups = Group::with('members:id,name')
            ->with('latestMessage.sender')
            ->withCount('members')
            ->whereHas('members', fn($q) => $q->where('users.id', auth()->id()))
            ->orderByDesc('updated_at') 
            ->get();

        return response()->json($groups);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name'    => 'required|string|max:100',
            'member_ids' => 'required|array|min:1',
            'member_ids.*' => 'exists:users,id'
        ]);

        $group = Group::create([
            'name' => $data['name'],
            'owner_id' => auth()->id(),
        ]);

        $group->members()->sync(array_unique(array_merge($data['member_ids'], [auth()->id()])));

        return response()->json($group->load('members:id,name'));
    }

    public function messages(Group $group)
    {
        $authId = auth()->id();
        // authorize: user harus member
        abort_unless($group->members()->where('users.id',auth()->id())->exists(), 403);

        $messages = GroupMessage::where('group_id', $group->id)
        ->whereDoesntHave('hiddenForUsers', function ($query) use ($authId) {
            $query->where('user_id', $authId);
        })
        ->with('sender:id,name')
        ->orderByDesc('created_at')
        ->simplePaginate(50);

        return response()->json($messages);
    }

    public function send(Request $request, Group $group)
    {
        abort_unless($group->members()->where('users.id', auth()->id())->exists(), 403);

        $request->validate([ 'message' => 'required|string|max:2000' ]);

        $message = $group->messages()->create([
            'sender_id' => auth()->id(),
            'message' => $request->message,
        ]);

        broadcast(new GroupMessageSent($message))->toOthers();

        return response()->json($message);
    }

    public function destroy(GroupMessage $message)
    {
        // Otorisasi: Pastikan pengguna yang request adalah pengirim pesan.
        if ($message->sender_id !== auth()->id()) {
            return response()->json(['error' => 'Anda tidak memiliki izin untuk menghapus pesan ini.'], 403);
        }

        // Simpan ID pesan sebelum dihapus
        $deletedMessageId = $message->id;
        
        // Hapus pesan dari database
        $message->delete();

        // Kirim respons sukses kembali ke si penghapus.
        return response()->json([
            'message' => 'Pesan grup berhasil dihapus.',
            'deleted_message_id' => $deletedMessageId
        ], 200);
    }

}

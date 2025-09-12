<?php

namespace App\Http\Controllers;

use App\Events\GroupMessageSent;
use App\Models\Group;
use App\Models\GroupMessage;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class GroupController extends Controller
{
    public function index()
    {
        $groups = Group::with('members:id,name') // <-- Tetap ada untuk daftar anggota
            ->with('latestMessage.sender')  // <-- TAMBAHKAN BARIS INI
            ->withCount('members')
            ->whereHas('members', fn($q) => $q->where('users.id', auth()->id()))
            ->orderByDesc('updated_at') // Opsional: urutkan grup berdasarkan aktivitas terakhir
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
        // authorize: user harus member
        abort_unless($group->members()->where('users.id',auth()->id())->exists(), 403);

        $messages = $group->messages()
            ->with('sender:id,name')
            ->orderBy('created_at')
            ->get();

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
}

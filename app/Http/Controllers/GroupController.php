<?php

namespace App\Http\Controllers;

use App\Events\GroupMessageSent;
use App\Events\MessageDeleted;
use App\Models\Group;
use App\Models\GroupMessage;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

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
        if ($message->sender_id !== auth()->id()) {
            return response()->json(['error' => 'Anda tidak memiliki izin untuk menghapus pesan ini.'], 403);
        }
        $deletedMessageId = $message->id;
        $message->delete();

        broadcast(new MessageDeleted($message))->toOthers();

        return response()->json([
            'message' => 'Pesan grup berhasil dihapus.',
            'deleted_message_id' => $deletedMessageId
        ], 200);
    }

    public function storeFile(Request $request, $groupId)
    {
        $validator = Validator::make($request->all(), [
            'file' => 'required|file|max:25600',
        ]);

        if ($validator->fails()) {
            return response()->json($validator->errors(), 422);
        }

        $file = $request->file('file');
        $path = $file->store('group_files', 'public');
        $mime = $file->getMimeType();

        $type = 'file';
        if (str_starts_with($mime, 'image/')) {
            $type = 'image';
        } elseif (str_starts_with($mime, 'video/')) {
            $type = 'video';
        }
        $message = GroupMessage::create([
            'group_id'       => $groupId,
            'sender_id'      => auth()->id(),
            'message'        => $request->input('text'),
            'type'           => $type,
            'file_path'      => $path,
            'file_name'      => $file->getClientOriginalName(),
            'file_mime_type' => $mime,
            'file_size'      => $file->getSize(),
        ]);
        $message->load('sender');
        broadcast(new GroupMessageSent($message))->toOthers();
        return response()->json($message, 201);
    }
}
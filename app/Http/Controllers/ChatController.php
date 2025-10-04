<?php
namespace App\Http\Controllers;

use App\Models\User;
use App\Models\ChatMessage;
use App\Events\MessageSent;
use App\Events\MessageRead;
use App\Events\MessageDeleted;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Http\JsonResponse;

class ChatController extends Controller
{
    public function index()
    {
        return inertia('Chat');
    }

    public function contacts()
    {
        try {
        $contacts = User::where('id', '!=', auth()->id())
                        ->get(['id', 'name', 'last_seen', 'phone_number']);

        $authId = auth()->id();

        foreach ($contacts as $contact) {
            $contact->latest_message = ChatMessage::where(function ($query) use ($authId, $contact) {
                $query->where('sender_id', $authId)
                      ->where('receiver_id', $contact->id);
            })->orWhere(function ($query) use ($authId, $contact) {
                $query->where('sender_id', $contact->id)
                      ->where('receiver_id', $authId);
            })
            ->latest()
            ->first();
        }

        return response()->json($contacts);

        } catch (\Exception $e) {
            report($e);
            return response()->json(['message' => 'Terjadi error di method contacts()', 'error' => $e->getMessage()], 500);
        }
    }

    public function messages(User $user)
    {
        $authId = auth()->id();

        $messages = ChatMessage::query()
            ->where(function ($query) use ($user, $authId) {
                $query->where('sender_id', $authId)
                    ->where('receiver_id', $user->id)
                    ->orWhere(function ($q) use ($user, $authId) {
                        $q->where('sender_id', $user->id)
                            ->where('receiver_id', $authId);
                    });
            })
            ->whereDoesntHave('hiddenForUsers', function ($query) use ($authId) {
                $query->where('user_id', $authId);
            })
            
            ->with('sender:id,name', 'parentMessage.sender:id,name')
            ->orderByDesc('created_at')
            ->simplePaginate(50);

        return response()->json($messages);
    }

    public function sendMessage(Request $request)
    {
        $request->validate([
            'receiver_id' => 'required|exists:users,id',
            'message' => 'required|string'
        ]);

        $message = ChatMessage::create([
            'sender_id' => auth()->id(),
            'receiver_id' => $request->receiver_id,
            'message' => $request->message
        ]);

        // broadcast to others (sender will update UI optimistically)
        broadcast(new MessageSent($message))->toOthers();

        return response()->json($message);
    }

    public function MarkAsRead(Request $request){
        $request->validate(['sender_id' => 'required|integer']);
        ChatMessage::where('sender_id', $request->sender_id)
        ->where('receiver_id', auth()->id())
        ->whereNull('read_at')
        ->update(['read_at' => now()]);

        broadcast(new MessageRead(auth()->id(), $request->sender_id));

    return response()->json(['status' => 'success']);
    }

    public function getUnreadCounts(): JsonResponse
    {
        try {
            $userId = auth()->id();
            $userUnreads = DB::table('chat_messages')
                ->select('sender_id', DB::raw('count(*) as messages_count'))
                ->where('receiver_id', $userId)
                ->whereNull('read_at')
                ->whereNull('deleted_at')
                ->groupBy('sender_id')
                ->get();
            $unreadCounts = [];
            foreach ($userUnreads as $unread) {
                $key = 'user-' . $unread->sender_id;
                $unreadCounts[$key] = $unread->messages_count;
            }
            return response()->json($unreadCounts);

        } catch (\Exception $e) {
            report($e);
            return response()->json(['message' => 'Gagal memuat jumlah pesan belum dibaca.'], 500);
        }
    }

    public function destroy(ChatMessage $message)
    {
        if ($message->sender_id !== auth()->id()) {
            return response()->json(['error' => 'Anda tidak memiliki izin untuk menghapus pesan ini.'], 403);
        }

        $message->delete();
        broadcast(new MessageDeleted($message))->toOthers();

        return response()->json([
            'message' => 'Pesan berhasil dihapus untuk semua orang.',
            'deleted_message_id' => $message->id
        ], 200);
    }

    public function storeFile(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'file' => 'required|file|max:25600', // Batas 25MB
            'receiver_id' => 'required|exists:users,id',
        ]);

        if ($validator->fails()) {
            return response()->json($validator->errors(), 422);
        }

        $file = $request->file('file');
        $path = $file->store('chat_files', 'public');
        $mime = $file->getMimeType();

        $type = 'file';
        if (str_starts_with($mime, 'image/')) {
            $type = 'image';
        } elseif (str_starts_with($mime, 'video/')) {
            $type = 'video';
        }
        $message = ChatMessage::create([
            'sender_id'      => auth()->id(),
            'receiver_id'    => $request->input('receiver_id'),
            'message'        => $request->input('text'),
            'type'           => $type,
            'file_path'      => $path,
            'file_name'      => $file->getClientOriginalName(),
            'file_mime_type' => $mime,
            'file_size'      => $file->getSize(),
        ]);
        $message->load('sender');
        broadcast(new MessageSent($message))->toOthers(); 
        return response()->json($message, 201);
    }
}
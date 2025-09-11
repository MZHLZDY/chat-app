<?php
namespace App\Http\Controllers;

use App\Models\User;
use App\Models\ChatMessage;
use App\Events\MessageSent;
use App\Events\MessageRead;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Http\JsonResponse;

class ChatController extends Controller
{
    public function index()
    {
        return inertia('Chat');
    }

    public function contacts()
    {
        $contacts = User::where('id', '!=', auth()->id())
                    ->get(['id', 'name', 'last_seen', 'phone_number']);
        
        $contacts->each(function ($contact) {
            $contact->latest_message = ChatMessage::where(function ($query) use ($contact) {
                $query->where('sender_id', auth()->id())
                    ->where('receiver_id', $contact->id);
            })->orWhere(function ($query) use ($contact) {
                $query->where('sender_id', $contact->id)
                    ->where('receiver_id', auth()->id());
            })->latest()->first();
        });

        return response()->json($contacts);
    }

    public function messages(User $user)
    {
        $messages = ChatMessage::where(function($q) use ($user) {
            $q->where('sender_id', auth()->id())
              ->where('receiver_id', $user->id);
        })->orWhere(function($q) use ($user) {
            $q->where('sender_id', $user->id)
              ->where('receiver_id', auth()->id());
        })->orderBy('created_at')->get();

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

            // 1. Menghitung pesan personal yang belum dibaca
            $userUnreads = DB::table('chat_messages')
                ->select('sender_id', DB::raw('count(*) as messages_count'))
                ->where('receiver_id', $userId)
                ->whereNull('read_at')
                ->groupBy('sender_id')
                ->get();

            // 2. Format data agar cocok dengan state di frontend (contoh: { 'user-5': 3 })
            $unreadCounts = [];
            foreach ($userUnreads as $unread) {
                $key = 'user-' . $unread->sender_id;
                $unreadCounts[$key] = $unread->messages_count;
            }

            // 3. Kembalikan data dalam format JSON
            return response()->json($unreadCounts);

        } catch (\Exception $e) {
            // 4. Jika terjadi error, kirim respons error 500
            // Ini akan membantu debugging di frontend
            report($e); // Opsional: catat error ke log
            return response()->json(['message' => 'Gagal memuat jumlah pesan belum dibaca.'], 500);
        }
    }
}

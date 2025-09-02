<?php
namespace App\Http\Controllers;

use App\Models\User;
use App\Models\ChatMessage;
use App\Events\MessageSent;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

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
}

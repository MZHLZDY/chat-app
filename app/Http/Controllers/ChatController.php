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
        return inertia('Chat/Index');
    }

    public function contacts()
    {
        $contacts = User::where('id', '!=', Auth::id())->get(['id', 'name']);
        return response()->json($contacts);
    }

    public function messages(User $user)
    {
        $messages = ChatMessage::where(function($q) use ($user) {
            $q->where('sender_id', auth()->id())
                ->where('receiver_id', $user->id);
            })
            ->orWhere(function($q) use ($user) {
                $q->where('sender_id', $user->id)
                ->where('receiver_id', auth()->id());
            })
            ->orderBy('created_at')
            ->get();

        return response()->json($messages);
    }


    // public function send(Request $request)
    // {
    //     $message = Message::create([
    //         'sender_id' => Auth::id(),
    //         'receiver_id' => $request->receiver_id,
    //         'message' => $request->message
    //     ]);
    //     return response()->json($message);
    // }

    public function sendMessage(Request $request)
    {
        $request->validate([
            'receiver_id' => 'required|exists:users,id',
            'message' => 'required|string'
        ]);

        $message = \App\Models\ChatMessage::create([
            'sender_id' => auth()->id(),
            'receiver_id' => $request->receiver_id,
            'message' => $request->message
        ]);

        broadcast(new \App\Events\MessageSent($message))->toOthers();

        return response()->json(['status' => 'success', 'message' => $message]);
    }
}

<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use App\Models\ChatMessage;
use App\Events\MessageSent;

class MessageController extends Controller
{
    public function index($friendId)
    {
        $myId = Auth::id();

        $messages = ChatMessage::where(function($q) use ($myId, $friendId) {
            $q->where('sender_id', $myId)->where('receiver_id', $friendId);
        })->orWhere(function($q) use ($myId, $friendId) {
            $q->where('sender_id', $friendId)->where('receiver_id', $myId);
        })
        ->orderBy('created_at', 'asc')
        ->get();

        return response()->json($messages);
    }

    public function store(Request $request)
    {
        $request->validate([
            'receiver_id' => 'required',
            'message' => 'required',
        ]);

        $chatMessage = ChatMessage::create([
            'sender_id' => Auth::id(),
            'receiver_id' => $request->receiver_id,
            'message' => $request->message,
            'type' => 'text'
        ]);

        // Broadcast Event
        broadcast(new MessageSent($chatMessage))->toOthers();

        return response()->json($chatMessage);
    }
}
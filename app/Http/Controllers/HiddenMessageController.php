<?php
namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\HiddenMessage;

class HiddenMessageController extends Controller
{
    public function store(Request $request)
    {
        $request->validate([
            'message_id' => 'required|integer',
            'message_type' => 'required|string|in:chat,group',
        ]);

        $messageClass = $request->message_type === 'group' 
            ? \App\Models\GroupMessage::class 
            : \App\Models\ChatMessage::class;

        HiddenMessage::create([
            'user_id' => auth()->id(),
            'message_id' => $request->message_id,
            'message_type' => $messageClass,
        ]);

        return response()->noContent();
    }
}

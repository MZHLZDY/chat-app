<?php

namespace App\Http\Controllers;

use App\Events\CallSignal;
use Illuminate\Http\Request;

class CallController extends Controller
{
    public function signal(Request $request)
    {
        $payload = $request->validate([
            'type' => 'required|in:offer,answer,candidate,end',
            'to'   => 'required|exists:users,id',
            'data' => 'nullable|array'
        ]);

        $enriched = [
            'type' => $payload['type'],
            'from' => auth()->id(),
            'to'   => (int)$payload['to'],
            'data' => $payload['data'] ?? null,
        ];

        broadcast(new \App\Events\CallSignal($enriched, $payload['to']))->toOthers();

        return response()->json(['ok' => true]);
    }
}

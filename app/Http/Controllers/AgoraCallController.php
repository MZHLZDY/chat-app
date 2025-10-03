<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use App\Models\User;
use App\Services\AgoraTokenService; // GUNAKAN INI
use App\Events\IncomingCall;
use App\Events\CallAccepted;
use App\Events\CallRejected;
use App\Events\CallEnded;

class AgoraCallController extends Controller
{
    public function inviteCall(Request $request)
    {
        Log::info('inviteCall called', $request->all());
        
        $request->validate([
            'callee_id' => 'required|exists:users,id',
            'call_type' => 'required|in:voice,video'
        ]);

        $caller = $request->user();
        $callee = User::find($request->callee_id);

        if (!$callee) {
            return response()->json(['error' => 'User not found'], 404);
        }

        $callId = uniqid();
        $channel = 'call-' . $callId;
        
        Log::info('Caller and callee', [
            'caller_id' => $caller->id,
            'caller_name' => $caller->name,
            'callee_id' => $callee->id,
            'callee_name' => $callee->name,
            'channel' => $channel
        ]);

        Log::info('Broadcasting IncomingCall to user.' . $callee->id);
        
        // Broadcast incoming call ke callee
        event(new IncomingCall(
            caller: $caller,
            callee: $callee,
            callType: $request->call_type,
            channel: $channel
        ));

        Log::info('IncomingCall event broadcasted');

        return response()->json([
            'call_id' => $callId,
            'channel' => $channel,
            'status' => 'calling'
        ]);
    }
    public function answerCall(Request $request)
    {
        $request->validate([
            'call_id' => 'required|string',
            'caller_id' => 'required|exists:users,id',
            'accepted' => 'required|boolean',
            'reason' => 'nullable|string'
        ]);

        $callee = $request->user();

        if ($request->accepted) {
            // Panggilan diterima
            event(new CallAccepted(
                callerId: $request->caller_id,
                callee: $callee,
                channel: 'call-' . $request->call_id
            ));
        } else {
            // Panggilan ditolak
            event(new CallRejected(
                callerId: $request->caller_id,
                reason: $request->reason ?? 'Call rejected'
            ));
        }

        return response()->json(['message' => 'Call answered']);
    }

    public function endCall(Request $request)
    {
        $request->validate([
            'call_id' => 'required|string',
            'participant_ids' => 'required|array',
            'reason' => 'nullable|string'
        ]);

        event(new CallEnded(
            channel: 'call-' . $request->call_id,
            participantIds: $request->participant_ids,
            endedBy: $request->user()->id
        ));

        return response()->json(['message' => 'Call ended']);
    }

    public function generateToken(Request $request)
{
    $request->validate([
        'channel' => 'required|string',
        'uid' => 'required|integer'
    ]);

    // Fallback langsung ke env() jika config tidak bekerja
    $appId = env('AGORA_APP_ID');
    $appCertificate = env('AGORA_APP_CERTIFICATE');
    
    if (empty($appId) || empty($appCertificate)) {
        return response()->json([
            'error' => 'Agora configuration not found. Please check your .env file.'
        ], 500);
    }

    $channelName = $request->channel;
    $uid = $request->uid;

    $token = AgoraTokenService::generateRtcToken(
        $appId, 
        $appCertificate, 
        $channelName, 
        $uid, 
        'publisher', 
        3600
    );

    return response()->json([
        'token' => $token,
        'app_id' => $appId,
        'channel' => $channelName,
        'uid' => $uid
    ]);
}
}
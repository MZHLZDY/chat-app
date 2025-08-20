<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\User;
use App\Services\AgoraTokenService; // GUNAKAN INI
use App\Events\IncomingCall;
use App\Events\CallAccepted;
use App\Events\CallRejected;
use App\Events\CallEnded;

class AgoraCallController extends Controller
{
    /**
     * Generate Agora Token
     */
    public function generateToken(Request $request)
    {
        $request->validate([
            'channel' => 'required|string',
            'uid' => 'required|integer'
        ]);

        $appId = config('services.agora.app_id');
        $appCertificate = config('services.agora.app_certificate');
        $channelName = $request->channel;
        $uid = $request->uid;

        // GUNAKAN AgoraTokenService BUKAN AccessToken
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

    /**
     * Initiate a new call
     */
    public function initiateCall(Request $request)
    {
        $request->validate([
            'callee_id' => 'required|exists:users,id',
            'call_type' => 'required|in:voice,video'
        ]);

        $caller = $request->user();
        $callee = User::find($request->callee_id);

        // Broadcast event ke penerima panggilan
        event(new IncomingCall(
            caller: $caller,
            callee: $callee,
            callType: $request->call_type,
            channel: 'call-' . uniqid()
        ));

        return response()->json([
            'message' => 'Call initiated',
            'channel' => 'call-' . uniqid()
        ]);
    }

    /**
     * Accept call
     */
    public function acceptCall(Request $request)
    {
        $request->validate([
            'channel' => 'required|string',
            'caller_id' => 'required|exists:users,id'
        ]);

        $callee = $request->user();

        event(new CallAccepted(
            callerId: $request->caller_id,
            callee: $callee,
            channel: $request->channel
        ));

        return response()->json(['message' => 'Call accepted']);
    }

    /**
     * Reject call
     */
    public function rejectCall(Request $request)
    {
        $request->validate([
            'caller_id' => 'required|exists:users,id'
        ]);

        event(new CallRejected(
            callerId: $request->caller_id,
            reason: $request->reason ?? 'Call rejected'
        ));

        return response()->json(['message' => 'Call rejected']);
    }

    /**
     * End call
     */
    public function endCall(Request $request)
    {
        $request->validate([
            'channel' => 'required|string',
            'participant_ids' => 'required|array'
        ]);

        event(new CallEnded(
            channel: $request->channel,
            participantIds: $request->participant_ids
        ));

        return response()->json(['message' => 'Call ended']);
    }
}
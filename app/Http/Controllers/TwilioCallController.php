<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;
use App\Models\User;
use App\Models\Group;
use App\Services\AgoraTokenService;
use App\Events\IncomingCallVoice;
use App\Events\GroupIncomingCallVoice;
use App\Events\GroupCallAnswered;
use App\Events\GroupCallEnded;
use App\Events\GroupCallCancelled;
use App\Events\GroupParticipantLeft;
use App\Events\CallAccepted;
use App\Events\CallStarted;
use App\Events\CallRejected;
use App\Events\CallEnded;

use Twilio\Jwt\AccessToken;
use Twilio\Jwt\Grants\VideoGrant;

class TwilioCallController extends Controller
{
    public function inviteCall(Request $request)
    {
        $request->validate([ 'callee_id' => 'required|exists:users,id' ]);

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
        event(new IncomingCallVoice(
            caller: $caller,
            callee: $callee,
            callType: 'voice',
            channel: $roomName // Di sisi frontend nanti, ini akan dibaca sebagai roomName
        ));

        // Mengembalikan nama room ke penelepon agar bisa langsung join
        return response()->json([
            'room_name' => $roomName,
            'status' => 'calling',
        ]);
    }

    public function answerCall(Request $request)
{
    try {
        Log::info('Answer call request received', $request->all());
        
        $request->validate([
            'call_id' => 'required|string|max:255',
            'caller_id' => 'required|integer|exists:users,id',
            'accepted' => 'required|boolean',
            'reason' => 'nullable|string|max:500'
        ]);

        $callee = $request->user();
        $caller = User::find($request->caller_id);

        if (!$caller) {
            Log::error('Caller not found', ['caller_id' => $request->caller_id]);
            return response()->json(['error' => 'Caller not found'], 404);
        }

        if ($request->accepted) {
            // ✅ KIRIM DATA CALLER LENGKAP ke event
            event(new CallAccepted(
                callerId: $caller->id,
                callee: $callee,
                channel: 'call-' . $request->call_id,
                callId: $request->call_id
            ));

            // ✅ KIRIM DATA CALLER LENGKAP ke event CallStarted
            event(new CallStarted(
                callId: $request->call_id,
                callType: 'voice',
                channel: 'call-' . $request->call_id,
                caller: $caller // Kirim object User lengkap
            ));
        } else {
            event(new CallRejected(
                callId: $request->call_id,
                callerId: $caller->id,
                reason: $request->reason ?? 'Panggilan ditolak',
                calleeId: $callee->id
            ));
        }

        return response()->json([
            'status' => 'success',
            'message' => $request->accepted ? 'Panggilan diterima' : 'Panggilan ditolak',
            'call_id' => $request->call_id
        ]);

    } catch (\Illuminate\Validation\ValidationException $e) {
        Log::error('Validation error in answerCall', ['errors' => $e->errors()]);
        return response()->json(['error' => 'Validation error', 'errors' => $e->errors()], 422);
        
    } catch (\Exception $e) {
        Log::error('Error in answerCall: ' . $e->getMessage());
        return response()->json(['error' => 'Internal server error'], 500);
    }
}

public function endCall(Request $request)
{
    $request->validate([
        'call_id' => 'required|string',
        'participant_ids' => 'required|array',
        'reason' => 'nullable|string'
    ]);

    $user = $request->user();

    Log::info('Ending call', [
        'call_id' => $request->call_id,
        'participant_ids' => $request->participant_ids,
        'reason' => $request->reason,
        'ended_by' => $user->id
    ]);

    // ✅ KIRIM DATA USER LENGKAP TANPA QUERY DI EVENT
    event(new CallEnded(
        channel: 'call-' . $request->call_id,
        participantIds: $request->participant_ids,
        endedBy: $user->id,
        endedByName: $user->name, 
        reason: $request->reason
    ));

    return response()->json([
        'message' => 'Call ended',
        'call_id' => $request->call_id
    ]);
}

    public function generateToken(Request $request)
    {
        $request->validate([
            'room_name' => 'required|string',
        ]);

        $accountSid = config('services.twilio.account_sid');
        $apiKeySid = config('services.twilio.api_key_sid');
        $apiKeySecret = config('services.twilio.api_key_secret');

        // Identity adalah nama unik untuk user yang meminta token
        $identity = str_replace(' ', '_', $request->user()->name) . '-' . $request->user()->id;
        
        $token = new AccessToken(
            $accountSid,
            $apiKeySid,
            $apiKeySecret,
            3600, // Token valid selama 1 jam
            $identity
        );

        $grant = new VideoGrant();
        $grant->setRoom($request->room_name);
        $token->addGrant($grant);

        return response()->json([
            'token' => $token->toJWT(),
            'identity' => $identity,
        ]);
    }

    // Di dalam app/Http/Controllers/AgoraCallController.php

    public function inviteGroupCall(Request $request) 
    {
        $request->validate(['group_id' => 'required|exists:groups,id']);
        $caller = $request->user();
        $group = Group::find($request->group_id);
        
        $allMembers = $group->members()->get(['users.id', 'users.name']);
        
        $allParticipants = $allMembers->map(function ($user) use ($caller) {
            return [ 'id' => $user->id, 'name' => $user->name, 'status' => $user->id === $caller->id ? 'accepted' : 'calling' ];
        })->toArray();
        
        $callId = uniqid('group-call-');
        $roomName = 'group-call-' . $group->id . '-' . time();
        
        event(new GroupIncomingCallVoice($callId, $group, $caller, 'voice', $roomName, $allParticipants));
        
        return response()->json([
            'call_id' => $callId, 
            'room_name' => $roomName,
            'participants' => $allParticipants, 
            'group' => ['id' => $group->id, 'name' => $group->name]
        ]);
    }

    public function answerGroupCall(Request $request) {
        $request->validate(['call_id' => 'required|string', 'group_id' => 'required|exists:groups,id', 'accepted' => 'required|boolean', 'reason' => 'nullable|string']);
        $user = $request->user();
        $group = Group::find($request->group_id);
        event(new GroupCallAnswered($request->call_id, $group, $user, $request->boolean('accepted'), $request->reason));
        return response()->json(['status' => 'success']);
    }

    public function endGroupCall(Request $request) {
        $request->validate(['call_id' => 'required|string', 'group_id' => 'required|exists:groups,id', 'reason' => 'nullable|string']);
        $user = $request->user();
        $group = Group::find($request->group_id);
        event(new GroupCallEnded($request->call_id, $group->id, $user, $request->reason));
        return response()->json(['status' => 'success']);
    }

    public function cancelGroupCall(Request $request) {
        $request->validate(['call_id' => 'required|string', 'participant_ids' => 'required|array']);
        $caller = $request->user();
        event(new GroupCallCancelled($request->call_id, $request->participant_ids, $caller));
        return response()->json(['message' => 'Panggilan berhasil dibatalkan']);
    }

    public function leaveGroupCall(Request $request) {
        $request->validate(['call_id' => 'required|string', 'group_id' => 'required|exists:groups,id']);
        $user = $request->user();
        $group = Group::find($request->group_id);
        event(new GroupParticipantLeft($request->call_id, $group, $user));
        return response()->json(['message' => 'Notifikasi keluar berhasil dikirim']);
    }

    public function recallParticipant(Request $request) {
        $request->validate(['call_id' => 'required|string', 'group_id' => 'required|exists:groups,id', 'user_id_to_recall' => 'required|exists:users,id', 'current_participants' => 'required|array']);
        $caller = $request->user();
        $group = Group::find($request->group_id);
        $userToRecall = User::find($request->user_id_to_recall);
        $participants = $request->current_participants;
        event(new GroupIncomingCallVoice($request->call_id, $group, $caller, 'voice', 'group-call-' . $request->call_id, $participants, $userToRecall));
        return response()->json(['message' => 'Undangan panggilan ulang berhasil dikirim']);
    }

    public function missedGroupCall(Request $request) {
        Log::info('Missed group call:', $request->all());
        return response()->json(['status' => 'success']);
    }
    /**
     * Generate token untuk panggilan grup
     */
//     public function generateGroupToken(Request $request)
// {
//     Log::info('VERIFYING AGORA CREDENTIALS:', [
//         'app_id_from_config' => config('services.agora.app_id'),
//         'certificate_is_set' => !empty(config('services.agora.app_certificate'))
//     ]);

//     try {
//         Log::info('Group token request:', $request->all());
        
//         // --- PERBAIKAN 1: Longgarkan aturan validasi ---
//         $request->validate([
//             'channel' => 'required|string',
//             'uid' => 'required', // Hapus validasi 'string'
//             'role' => 'required|in:publisher,subscriber'
//         ]);

//         // --- PERBAIKAN 2: Ambil UID dan ubah secara manual ke string ---
//         $uid = (string) $request->input('uid');

//         $appId = config('services.agora.app_id');
//         $appCertificate = config('services.agora.app_certificate');
        
//         // Gunakan AgoraTokenService yang sama, tapi dengan $uid yang sudah pasti string
//         $token = AgoraTokenService::generateRtcToken(
//             $appId, 
//             $appCertificate, 
//             $request->channel, 
//             $uid, // Gunakan variabel $uid yang sudah di-casting
//             $request->role, 
//             3600
//         );

//         Log::info('Group token generated successfully', [
//             'channel' => $request->channel,
//             'uid' => $uid, // Log UID yang sudah di-casting
//             'role' => $request->role
//         ]);
        
//         return response()->json([
//             'token' => $token,
//             'app_id' => $appId,
//             'uid' => $uid, // Kirim kembali UID sebagai string
//             'channel' => $request->channel,
//             'role' => $request->role,
//             'mode' => empty($appCertificate) ? 'testing' : 'secure'
//         ]);
        
//     } catch (\Exception $e) {
//         // Tambahkan detail error validasi ke log untuk debugging di masa depan
//         if ($e instanceof \Illuminate\Validation\ValidationException) {
//             Log::error('Validation error generating group token: ', $e->errors());
//             return response()->json(['error' => 'Validation failed', 'details' => $e->errors()], 422);
//         }
        
//         Log::error('Error generating group token: ' . $e->getMessage());
//         return response()->json(['error' => 'Gagal generate token'], 500);
//     }
// }
    
    /**
     * Menangani panggilan grup yang tidak dijawab
     */
}

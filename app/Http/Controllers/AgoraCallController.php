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
use App\Events\CallAccepted;
use App\Events\CallStarted;
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
        event(new IncomingCallVoice(
            caller: $caller,
            callee: $callee,
            callType: $request->call_type,
            channel: $channel
        ));

        Log::info('IncomingCall event broadcasted');

        return response()->json([
            'call_id' => $callId,
            'channel' => $channel,
            'status' => 'calling',
            'caller' => [ // TAMBAHKAN INFO CALLER UNTUK DEBUGGING
                'id' => $caller->id,
                'name' => $caller->name
            ]
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

        Log::info('Processing call answer', [
            'call_id' => $request->call_id,
            'caller' => $caller->name,
            'callee' => $callee->name,
            'accepted' => $request->accepted
        ]);

        if ($request->accepted) {
            // Kirim event ke CALLER bahwa panggilan diterima
            event(new CallAccepted(
                callerId: $caller->id,
                callee: $callee,
                channel: 'call-' . $request->call_id,
                callId: $request->call_id
            ));

            // KIRIM EVENT KE CALLEE UNTUK MENAMPILKAN UI PANGGILAN
            event(new CallStarted(
                callId: $request->call_id,
                callType: 'voice', // Anda bisa simpan call_type di database
                channel: 'call-' . $request->call_id,
                caller: $caller
            ));

            Log::info('Call accepted events sent to both parties');

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
        'channel' => 'required|string',
        'uid' => 'required|integer'
    ]);

    $appId = env('AGORA_APP_ID');
    $appCertificate = env('AGORA_APP_CERTIFICATE');
    
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
        'token' => $token, // Bisa null untuk Testing Mode
        'app_id' => $appId,
        'channel' => $channelName,
        'uid' => $uid,
        'mode' => empty($appCertificate) ? 'testing' : 'secure'
    ]);
}

    // TAMBAHKAN METHOD UNTUK HANDLE MISSED CALL
    public function inviteGroupCall(Request $request)
    {
        DB::beginTransaction();
        try {
            Log::info('Group call invite request:', $request->all());
            
            $request->validate([
                'group_id' => 'required|exists:groups,id',
                'call_type' => 'required|in:voice,video'
            ]);
            
            $caller = auth()->user();
            $groupId = $request->group_id;
            
            // Cek apakah user adalah anggota grup menggunakan query langsung
            $isMember = DB::table('group_user')
                ->where('group_id', $groupId)
                ->where('user_id', $caller->id)
                ->exists();
            
            if (!$isMember) {
                return response()->json(['error' => 'Anda bukan anggota grup ini'], 403);
            }
            
            // Ambil data grup
            $group = Group::find($groupId);
            
            // Ambil anggota grup (exclude caller)
            $participants = DB::table('group_user')
                ->join('users', 'group_user.user_id', '=', 'users.id')
                ->where('group_user.group_id', $groupId)
                ->where('users.id', '!=', $caller->id)
                ->select('users.id', 'users.name')
                ->get()
                ->map(function($user) {
                    return [
                        'id' => $user->id,
                        'name' => $user->name,
                        'status' => 'calling'
                    ];
                })
                ->toArray();
            
            Log::info('Group call participants:', $participants);
            
            $callId = uniqid();
            $channel = 'group-call-' . $callId;
            
            // Broadcast panggilan ke semua anggota grup
            event(new GroupIncomingCallVoice(
                $callId,
                $group,
                $caller,
                $request->call_type,
                $channel,
                $participants
            ));
            
            DB::commit();
            
            return response()->json([
                'call_id' => $callId,
                'channel' => $channel,
                'participants' => $participants,
                'group' => [
                    'id' => $group->id,
                    'name' => $group->name
                ]
            ]);
            
        } catch (\Illuminate\Validation\ValidationException $e) {
            DB::rollBack();
            Log::error('Validation error in group call:', $e->errors());
            return response()->json(['error' => 'Data tidak valid', 'details' => $e->errors()], 422);
            
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Error starting group call: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString()
            ]);
            return response()->json([
                'error' => 'Gagal memulai panggilan grup',
                'message' => $e->getMessage()
            ], 500);
        }
    }
    
    /**
     * Menjawab panggilan grup
     */
    public function answerGroupCall(Request $request)
    {
        try {
            Log::info('Group call answer request:', $request->all());
            
            $request->validate([
                'call_id' => 'required',
                'accepted' => 'required|boolean',
                'reason' => 'nullable|string'
            ]);
            
            $user = auth()->user();
            $accepted = $request->boolean('accepted');
            
            // Di sini Anda bisa menyimpan status jawaban ke database jika diperlukan
            // Contoh: menyimpan ke tabel call_participants
            
            return response()->json([
                'status' => 'success',
                'message' => $accepted ? 'Panggilan diterima' : 'Panggilan ditolak',
                'user' => [
                    'id' => $user->id,
                    'name' => $user->name
                ]
            ]);
            
        } catch (\Exception $e) {
            Log::error('Error answering group call: ' . $e->getMessage());
            return response()->json(['error' => 'Gagal menjawab panggilan grup'], 500);
        }
    }
    
    /**
     * Mengakhiri panggilan grup
     */
    public function endGroupCall(Request $request)
    {
        try {
            Log::info('Group call end request:', $request->all());
            
            $request->validate([
                'call_id' => 'required',
                'reason' => 'nullable|string'
            ]);
            
            $user = auth()->user();
            
            // Di sini Anda bisa update status panggilan di database
            
            return response()->json([
                'status' => 'success',
                'message' => 'Panggilan diakhiri',
                'ended_by' => [
                    'id' => $user->id,
                    'name' => $user->name
                ]
            ]);
            
        } catch (\Exception $e) {
            Log::error('Error ending group call: ' . $e->getMessage());
            return response()->json(['error' => 'Gagal mengakhiri panggilan grup'], 500);
        }
    }
    
    /**
     * Generate token untuk panggilan grup
     */
    public function generateGroupToken(Request $request)
    {
        try {
            Log::info('Group token request:', $request->all());
            
            $request->validate([
                'channel' => 'required|string',
                'uid' => 'required|string',
                'role' => 'required|in:publisher,subscriber'
            ]);
            
            // Generate token sederhana untuk testing
            $token = "group-token-" . uniqid();
            
            return response()->json([
                'token' => $token,
                'app_id' => config('services.agora.app_id', 'test-app-id'),
                'uid' => $request->uid,
                'channel' => $request->channel
            ]);
            
        } catch (\Exception $e) {
            Log::error('Error generating group token: ' . $e->getMessage());
            return response()->json(['error' => 'Gagal generate token'], 500);
        }
    }
    
    /**
     * Menangani panggilan grup yang tidak dijawab
     */
    public function missedGroupCall(Request $request)
    {
        try {
            Log::info('Missed group call:', $request->all());
            
            $request->validate([
                'call_id' => 'required',
                'reason' => 'nullable|string'
            ]);
            
            // Log missed call ke database atau sistem notifikasi
            
            return response()->json([
                'status' => 'success',
                'message' => 'Panggilan missed dicatat'
            ]);
            
        } catch (\Exception $e) {
            Log::error('Error handling missed group call: ' . $e->getMessage());
            return response()->json(['error' => 'Gagal menangani panggilan missed'], 500);
        }
    }
}

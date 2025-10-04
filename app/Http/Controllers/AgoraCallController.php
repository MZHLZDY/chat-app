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
use App\Notifications\IncomingCallNotification; // ✅ IMPORT BARU

class AgoraCallController extends Controller
{
    public function inviteCall(Request $request)
    {
        $request->validate([
            'callee_id' => 'required|exists:users,id',
            'call_type' => 'required|in:voice,video'
        ]);

        $caller = $request->user();
        $callee = User::find($request->callee_id);

        // Generate call ID dan channel
        $callId = uniqid();
        $channel = 'call-' . $callId;

        // ✅ KIRIM NOTIFIKASI PUSHKALLL
        try {
            $callData = [
                'call_id' => $callId,
                'caller' => [
                    'id' => $caller->id,
                    'name' => $caller->name
                ],
                'channel' => $channel,
                'call_type' => $request->call_type
            ];

            // Kirim notifikasi ke callee
            $callee->notify(new IncomingCallNotification($callData, 'personal'));
            Log::info('Notifikasi panggilan personal dikirim', [
                'caller' => $caller->id,
                'callee' => $callee->id,
                'call_id' => $callId
            ]);

        } catch (\Exception $e) {
            Log::error('Gagal mengirim notifikasi panggilan personal: ' . $e->getMessage());
            // Jangan gagalkan panggilan hanya karena notifikasi gagal
        }

        // Panggil event seperti biasa
        event(new IncomingCallVoice(
            caller: $caller,
            callee: $callee,
            callType: $request->call_type,
            channel: $channel
        ));

        return response()->json([
            'call_id' => $callId,
            'channel' => $channel,
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
                // ✅ TUTUP NOTIFIKASI JIKA DITERIMA
                $this->closeCallNotification($request->call_id, 'personal', $callee->id);

                event(new CallAccepted(
                    callerId: $caller->id,
                    callee: $callee,
                    channel: 'call-' . $request->call_id,
                    callId: $request->call_id
                ));

                event(new CallStarted(
                    callId: $request->call_id,
                    callType: 'voice',
                    channel: 'call-' . $request->call_id,
                    caller: $caller
                ));
            } else {
                // ✅ TUTUP NOTIFIKASI JIKA DITOLAK
                $this->closeCallNotification($request->call_id, 'personal', $callee->id);

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

        // ✅ TUTUP NOTIFIKASI UNTUK SEMUA PARTICIPANT
        foreach ($request->participant_ids as $participantId) {
            $this->closeCallNotification($request->call_id, 'personal', $participantId);
        }

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
            'uid' => 'required|string'
        ]);

        return response()->json([
            'token' => null, 
            'app_id' => config('services.agora.app_id'),
            'uid' => $request->uid,
        ]);
    }

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
        $channel = 'group-call-' . $callId;

        // ✅ KIRIM NOTIFIKASI UNTUK SEMUA PARTICIPANT GRUP
        try {
            $callData = [
                'call_id' => $callId,
                'caller' => [
                    'id' => $caller->id,
                    'name' => $caller->name
                ],
                'channel' => $channel,
                'group' => [
                    'id' => $group->id,
                    'name' => $group->name
                ]
            ];

            // Kirim notifikasi ke semua peserta kecuali caller
            foreach ($allMembers as $participant) {
                if ($participant->id !== $caller->id) {
                    $participant->notify(new IncomingCallNotification($callData, 'group'));
                }
            }

            Log::info('Notifikasi panggilan grup dikirim', [
                'group_id' => $group->id,
                'caller' => $caller->id,
                'participants_count' => $allMembers->count() - 1,
                'call_id' => $callId
            ]);

        } catch (\Exception $e) {
            Log::error('Gagal mengirim notifikasi panggilan grup: ' . $e->getMessage());
        }

        event(new GroupIncomingCallVoice(
            $callId, 
            $group, 
            $caller, 
            'voice', 
            $channel, 
            $allParticipants
        ));
        
        return response()->json([
            'call_id' => $callId, 
            'channel' => $channel,
            'participants' => $allParticipants, 
            'group' => ['id' => $group->id, 'name' => $group->name]
        ]);
    }

    public function answerGroupCall(Request $request) {
        $request->validate([
            'call_id' => 'required|string', 
            'group_id' => 'required|exists:groups,id', 
            'accepted' => 'required|boolean', 
            'reason' => 'nullable|string'
        ]);
        
        $user = $request->user();
        $group = Group::find($request->group_id);

        // ✅ TUTUP NOTIFIKASI JIKA DIJAWAB
        if ($request->accepted) {
            $this->closeCallNotification($request->call_id, 'group', $user->id);
        }

        event(new GroupCallAnswered(
            $request->call_id, 
            $group, 
            $user, 
            $request->boolean('accepted'), 
            $request->reason
        ));
        
        return response()->json(['status' => 'success']);
    }

    public function endGroupCall(Request $request) {
        $request->validate([
            'call_id' => 'required|string', 
            'group_id' => 'required|exists:groups,id', 
            'reason' => 'nullable|string'
        ]);
        
        $user = $request->user();
        $group = Group::find($request->group_id);

        // ✅ TUTUP NOTIFIKASI UNTUK SEMUA PESERTA
        $allMembers = $group->members()->pluck('users.id')->toArray();
        foreach ($allMembers as $participantId) {
            $this->closeCallNotification($request->call_id, 'group', $participantId);
        }

        event(new GroupCallEnded($request->call_id, $group->id, $user, $request->reason));
        return response()->json(['status' => 'success']);
    }

    public function cancelGroupCall(Request $request) {
        $request->validate([
            'call_id' => 'required|string', 
            'participant_ids' => 'required|array'
        ]);
        
        $caller = $request->user();

        // ✅ TUTUP NOTIFIKASI UNTUK SEMUA PESERTA
        foreach ($request->participant_ids as $participantId) {
            $this->closeCallNotification($request->call_id, 'group', $participantId);
        }

        event(new GroupCallCancelled($request->call_id, $request->participant_ids, $caller));
        return response()->json(['message' => 'Panggilan berhasil dibatalkan']);
    }

    public function leaveGroupCall(Request $request) {
        $request->validate([
            'call_id' => 'required|string', 
            'group_id' => 'required|exists:groups,id'
        ]);
        
        $user = $request->user();
        $group = Group::find($request->group_id);

        // ✅ TUTUP NOTIFIKASI UNTUK USER INI
        $this->closeCallNotification($request->call_id, 'group', $user->id);

        event(new GroupParticipantLeft($request->call_id, $group, $user));
        return response()->json(['message' => 'Notifikasi keluar berhasil dikirim']);
    }

    public function recallParticipant(Request $request) {
        $request->validate([
            'call_id' => 'required|string', 
            'group_id' => 'required|exists:groups,id', 
            'user_id_to_recall' => 'required|exists:users,id', 
            'current_participants' => 'required|array'
        ]);
        
        $caller = $request->user();
        $group = Group::find($request->group_id);
        $userToRecall = User::find($request->user_id_to_recall);
        $participants = $request->current_participants;

        // ✅ KIRIM NOTIFIKASI ULANG
        try {
            $callData = [
                'call_id' => $request->call_id,
                'caller' => [
                    'id' => $caller->id,
                    'name' => $caller->name
                ],
                'channel' => 'group-call-' . $request->call_id,
                'group' => [
                    'id' => $group->id,
                    'name' => $group->name
                ]
            ];

            $userToRecall->notify(new IncomingCallNotification($callData, 'group'));
            Log::info('Notifikasi recall dikirim', [
                'to_user' => $userToRecall->id,
                'call_id' => $request->call_id
            ]);

        } catch (\Exception $e) {
            Log::error('Gagal mengirim notifikasi recall: ' . $e->getMessage());
        }

        event(new GroupIncomingCallVoice(
            $request->call_id, 
            $group, 
            $caller, 
            'voice', 
            'group-call-' . $request->call_id, 
            $participants, 
            $userToRecall
        ));
        
        return response()->json(['message' => 'Undangan panggilan ulang berhasil dikirim']);
    }

    public function missedGroupCall(Request $request) {
        Log::info('Missed group call:', $request->all());
        
        // ✅ TUTUP NOTIFIKASI UNTUK MISSED CALL
        if ($request->has('call_id') && $request->has('user_id')) {
            $this->closeCallNotification($request->call_id, 'group', $request->user_id);
        }
        
        return response()->json(['status' => 'success']);
    }

    public function generateGroupToken(Request $request)
    {
        $request->validate([
            'channel' => 'required|string',
            'uid' => 'required|string'
        ]);

        return response()->json([
            'token' => null, 
            'app_id' => config('services.agora.app_id'),
            'uid' => $request->input('uid'),
            'channel' => $request->channel,
        ]);
    }

    /**
     * ✅ METHOD BARU: Tutup notifikasi panggilan dari database
     */
    private function closeCallNotification($callId, $callType, $userId)
    {
        try {
            // Hapus notifikasi yang belum dibaca dari database
            DB::table('notifications')
                ->where('notifiable_id', $userId)
                ->where('type', IncomingCallNotification::class)
                ->where('read_at', null)
                ->where(function ($query) use ($callId, $callType) {
                    $query->where('data->call_id', $callId)
                          ->where('data->call_type', $callType);
                })
                ->update(['read_at' => now()]);

            Log::info('Notifikasi panggilan ditutup', [
                'call_id' => $callId,
                'call_type' => $callType,
                'user_id' => $userId
            ]);

        } catch (\Exception $e) {
            Log::error('Gagal menutup notifikasi: ' . $e->getMessage());
        }
    }

    /**
     * ✅ METHOD BARU: API untuk menandai notifikasi sebagai dibaca
     */
    public function markNotificationAsRead(Request $request)
    {
        $request->validate([
            'call_id' => 'required|string',
            'call_type' => 'required|in:personal,group'
        ]);

        $user = $request->user();

        $this->closeCallNotification($request->call_id, $request->call_type, $user->id);

        return response()->json(['status' => 'success']);
    }

    /**
     * ✅ METHOD BARU: Dapatkan notifikasi panggilan yang aktif
     */
    public function getActiveCallNotifications(Request $request)
    {
        $user = $request->user();

        $notifications = DB::table('notifications')
            ->where('notifiable_id', $user->id)
            ->where('type', IncomingCallNotification::class)
            ->where('read_at', null)
            ->orderBy('created_at', 'desc')
            ->get(['id', 'data', 'created_at']);

        return response()->json([
            'notifications' => $notifications->map(function ($notification) {
                return [
                    'id' => $notification->id,
                    'data' => json_decode($notification->data, true),
                    'created_at' => $notification->created_at
                ];
            })
        ]);
    }
}
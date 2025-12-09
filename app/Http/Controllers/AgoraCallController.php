<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;
use App\Models\User;
use App\Models\Group;
use App\Models\CallEvent;
use App\Models\ChatMessage;
use App\Models\PersonalCall;
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
use App\Events\MessageSent;
use App\Notifications\IncomingCallNotification;

class AgoraCallController extends Controller
{
    public function inviteCall(Request $request)
    {
        DB::beginTransaction();
        try {
            Log::info('📞 [INVITE CALL] Starting...', [
                'callee_id' => $request->callee_id,
                'call_type' => $request->call_type
            ]);

            $validator = \Validator::make($request->all(), [
                'callee_id' => 'required|exists:users,id',
                'call_type' => 'required|in:voice,video'
            ]);
            
            if ($validator->fails()) {
                Log::error('❌ Validation failed', $validator->errors()->toArray());
                return response()->json(['errors' => $validator->errors()], 422);
            }
            
            $caller = $request->user();
            $callee = User::find($request->callee_id);
            
            if ($callee->id === $caller->id) {
                return response()->json(['error' => 'Cannot call yourself'], 400);
            }

            $callId = uniqid('call_');
            $channel = 'call-' . $callId;
            
            Log::info('✅ [INVITE CALL] Call session created:', [
                'call_id' => $callId, 
                'channel' => $channel,
                'caller_id' => $caller->id,
                'callee_id' => $callee->id
            ]);

            // Simpan ke personal_calls
            PersonalCall::create([
                'call_id' => $callId,
                'channel_name' => $channel,
                'caller_id' => $caller->id,
                'callee_id' => $callee->id,
                'status' => 'calling',
                'call_type' => $request->call_type,
            ]);

            Log::info('✅ [INVITE CALL] PersonalCall record created');

            // ✅ Buat pesan call event
            try {
                $message = $this->createOrUpdateCallMessage(
                    callId: $callId,
                    channel: $channel,
                    callerId: $caller->id,
                    calleeId: $callee->id,
                    status: 'calling',
                    callType: $request->call_type
                );
                
                Log::info('✅ [INVITE CALL] Call message created', [
                    'message_id' => $message->id
                ]);
            } catch (\Exception $e) {
                Log::error('❌ [INVITE CALL] Failed to create call message: ' . $e->getMessage());
                // Continue anyway - message is not critical for call to work
            }

            // Kirim notifikasi
            try {
                $callData = [
                    'call_id' => $callId,
                    'caller_id' => $caller->id,
                    'caller_name' => $caller->name,
                    'channel' => $channel,
                    'call_type' => $request->call_type,
                    'timestamp' => now()->toISOString()
                ];
                
                $callee->notify(new IncomingCallNotification($callData, 'personal'));
                
                Log::info('✅ [INVITE CALL] Notification sent');
            } catch (\Exception $e) {
                Log::error('❌ [INVITE CALL] Failed to send notification: ' . $e->getMessage());
                // Continue - notification is not critical
            }

            // Broadcast event
            try {
                event(new IncomingCallVoice(
                    caller: $caller, 
                    callee: $callee, 
                    callType: $request->call_type,
                    channel: $channel, 
                    callId: $callId
                ));
                
                Log::info('✅ [INVITE CALL] Event broadcasted');
            } catch (\Exception $e) {
                Log::error('❌ [INVITE CALL] Failed to broadcast event: ' . $e->getMessage());
                // Continue - event is not critical
            }

            DB::commit();

            Log::info('✅ [INVITE CALL] SUCCESS - Transaction committed');

            return response()->json([
                'call_id' => $callId, 
                'channel' => $channel, 
                'status' => 'calling',
            ], 200);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('❌ [INVITE CALL] CRITICAL ERROR: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
                'file' => $e->getFile(),
                'line' => $e->getLine()
            ]);
            
            return response()->json([
                'error' => 'Internal server error',
                'message' => $e->getMessage(),
                'debug' => config('app.debug') ? [
                    'file' => $e->getFile(),
                    'line' => $e->getLine()
                ] : null
            ], 500);
        }
    }

    public function answerCall(Request $request)
    {
        DB::beginTransaction();
        try {
            Log::info('📞 [ANSWER CALL] Starting...', [
                'call_id' => $request->call_id,
                'accepted' => $request->accepted
            ]);

            $request->validate([
                'call_id' => 'required|string',
                'caller_id' => 'required|exists:users,id',
                'accepted' => 'required|boolean',
                'reason' => 'nullable|string'
            ]);

            $callee = $request->user();
            $caller = User::find($request->caller_id);

            if (!$caller) {
                return response()->json(['error' => 'Caller not found'], 404);
            }

            $call = PersonalCall::where('call_id', $request->call_id)->first();
            
            if (!$call) {
                Log::warning('❌ Call not found for answer:', ['call_id' => $request->call_id]);
                return response()->json(['error' => 'Call not found'], 404);
            }

            // Update status panggilan
            $call->update([
                'status' => $request->accepted ? 'accepted' : 'rejected',
                'ended_at' => $request->accepted ? null : now(),
                'reason' => $request->accepted ? null : ($request->reason ?? 'Ditolak')
            ]);

            Log::info('✅ [ANSWER CALL] PersonalCall updated');

            // Update pesan
            try {
                $message = $this->createOrUpdateCallMessage(
                    callId: $request->call_id,
                    channel: $call->channel_name,
                    callerId: $caller->id,
                    calleeId: $callee->id,
                    status: $request->accepted ? 'accepted' : 'rejected',
                    callType: $call->call_type,
                    reason: $request->accepted ? null : ($request->reason ?? 'Ditolak')
                );
                
                Log::info('✅ [ANSWER CALL] Call message updated', [
                    'message_id' => $message->id
                ]);
            } catch (\Exception $e) {
                Log::error('❌ [ANSWER CALL] Failed to update message: ' . $e->getMessage());
                $message = null;
            }

            // Trigger events
            try {
                if ($request->accepted) {
                    event(new CallAccepted(
                        callerId: $caller->id, 
                        callee: $callee,
                        channel: $call->channel_name, 
                        callId: $request->call_id,
                        message: $message
                    ));
                    
                    Log::info('✅ [ANSWER CALL] CallAccepted event triggered');
                } else {
                    event(new CallRejected(
                        callId: $request->call_id, 
                        callerId: $caller->id,
                        reason: $request->reason ?? 'Ditolak', 
                        calleeId: $callee->id, 
                        callType: $call->call_type,
                        message: $message
                    ));
                    
                    Log::info('✅ [ANSWER CALL] CallRejected event triggered');
                }
            } catch (\Exception $e) {
                Log::error('❌ [ANSWER CALL] Failed to trigger event: ' . $e->getMessage());
            }

            DB::commit();
            
            Log::info('✅ [ANSWER CALL] SUCCESS');

            return response()->json([
                'status' => 'success',
                'message' => $request->accepted ? 'Call accepted' : 'Call rejected'
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('❌ [ANSWER CALL] ERROR: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString()
            ]);
            
            return response()->json([
                'error' => 'Internal server error',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    public function endCall(Request $request)
    {
        try {
            Log::info('📞 [END CALL] Starting...', [
                'call_id' => $request->call_id
            ]);

            $validated = $request->validate([
                'call_id' => 'required|string|exists:personal_calls,call_id',
                'reason' => 'nullable|string',
                'duration' => 'nullable|integer',
            ]);

            $user = $request->user();
            $callId = $validated['call_id'];
            $duration = $validated['duration'] ?? 0;

            $call = PersonalCall::where('call_id', $callId)->first();

            if (!$call) {
                Log::warning('❌ Call not found');
                return response()->json(['message' => 'Call not found'], 404);
            }
            
            $participantIds = [$call->caller_id, $call->callee_id];
            $callType = $call->call_type;

            $call->update([
                'status' => 'ended',
                'ended_at' => now(),
                'duration_seconds' => $duration,
            ]);
            
            Log::info('✅ [END CALL] PersonalCall updated');

            // Close notifications
            foreach ($participantIds as $participantId) {
                $this->closeCallNotification($callId, 'personal', $participantId);
            }
            
            // Update message
            try {
                $message = $this->createOrUpdateCallMessage(
                    callId: $callId,
                    channel: $call->channel_name,
                    callerId: $call->caller_id,
                    calleeId: $call->callee_id,
                    status: 'ended',
                    duration: $duration,
                    callType: $callType,
                    reason: $validated['reason'] ?? 'Panggilan diakhiri'
                );
                
                Log::info('✅ [END CALL] Message updated', [
                    'message_id' => $message->id
                ]);
            } catch (\Exception $e) {
                Log::error('❌ [END CALL] Failed to update message: ' . $e->getMessage());
                $message = null;
            }

            // Broadcast event
            try {
                event(new CallEnded(
                    callId: $callId,
                    participantIds: $participantIds,
                    endedBy: $user->id,
                    endedByName: $user->name,
                    reason: $validated['reason'] ?? null,
                    duration: $duration,
                    callType: $callType,
                    message: $message
                ));
                
                Log::info('✅ [END CALL] Event broadcasted');
            } catch (\Exception $e) {
                Log::error('❌ [END CALL] Failed to broadcast event: ' . $e->getMessage());
            }

            Log::info('✅ [END CALL] SUCCESS');

            return response()->json([
                'message' => 'Call ended successfully',
                'call_id' => $callId
            ]);

        } catch (\Exception $e) {
            Log::error('❌ [END CALL] ERROR: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString()
            ]);
            
            return response()->json([
                'error' => 'Internal server error',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    public function generateToken(Request $request)
    {
        $request->validate([
            'channel' => 'required|string',
            'uid' => 'required|numeric'
        ]);

        return response()->json([
            'token' => null, 
            'app_id' => config('services.agora.app_id'),
            'uid' => $request->uid,
        ]);
    }

    /**
     * ✅ METHOD UTAMA: Create/Update Call Message
     */
    private function createOrUpdateCallMessage(
        string $callId,
        string $channel,
        int $callerId,
        int $calleeId,
        string $status,
        string $callType = 'voice',
        ?int $duration = null,
        ?string $reason = null
    ): ChatMessage {
        try {
            Log::info('📝 [CREATE/UPDATE MESSAGE] Starting...', [
                'call_id' => $callId,
                'status' => $status
            ]);

            // Cari pesan yang sudah ada
            $message = ChatMessage::where('type', 'call_event')
                ->where('sender_id', $callerId)
                ->where('receiver_id', $calleeId)
                ->whereRaw("JSON_EXTRACT(call_data, '$.call_id') = ?", [$callId])
                ->first();

            Log::info('🔍 [CREATE/UPDATE MESSAGE] Search result:', [
                'found' => $message ? 'yes' : 'no',
                'message_id' => $message?->id
            ]);

            $callData = [
                'call_id' => $callId,
                'channel' => $channel,
                'status' => $status,
                'call_type' => $callType,
            ];

            if ($duration !== null) {
                $callData['duration'] = $duration;
            }

            if ($reason !== null) {
                $callData['reason'] = $reason;
            }

            if ($message) {
                // Update existing message
                Log::info('🔄 [CREATE/UPDATE MESSAGE] Updating existing message');
                
                // Merge dengan data lama
                $existingData = $message->call_data ?? [];
                $mergedData = array_merge($existingData, $callData);
                
                $message->call_data = $mergedData;
                $message->message = $this->generateCallMessageText($mergedData);
                $message->save();
                
                Log::info('✅ [CREATE/UPDATE MESSAGE] Message updated', [
                    'message_id' => $message->id,
                    'text' => $message->message
                ]);
            } else {
                // Create new message
                Log::info('➕ [CREATE/UPDATE MESSAGE] Creating new message');
                
                $message = ChatMessage::create([
                    'sender_id' => $callerId,
                    'receiver_id' => $calleeId,
                    'type' => 'call_event',
                    'call_data' => $callData,
                    'message' => $this->generateCallMessageText($callData)
                ]);

                Log::info('✅ [CREATE/UPDATE MESSAGE] Message created', [
                    'message_id' => $message->id,
                    'text' => $message->message
                ]);
            }

            // Load relasi untuk broadcast
            $message->load('sender');

            // Broadcast
            try {
                broadcast(new MessageSent($message))->toOthers();
                Log::info('✅ [CREATE/UPDATE MESSAGE] Broadcasted');
            } catch (\Exception $e) {
                Log::error('❌ [CREATE/UPDATE MESSAGE] Broadcast failed: ' . $e->getMessage());
            }

            return $message;

        } catch (\Exception $e) {
            Log::error('❌ [CREATE/UPDATE MESSAGE] ERROR: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString()
            ]);
            throw $e;
        }
    }

    /**
     * ✅ HELPER: Generate call message text
     */
    private function generateCallMessageText(array $callData): string
    {
        $text = ($callData['call_type'] ?? 'voice') === 'video' 
            ? 'Panggilan Video' 
            : 'Panggilan Suara';

        switch ($callData['status'] ?? 'unknown') {
            case 'calling':   
                $text .= ' • Memanggil'; 
                break;
            case 'cancelled': 
                $text .= ' • Dibatalkan'; 
                break;
            case 'rejected':  
                $text .= ' • Ditolak';
                if (!empty($callData['reason']) && $callData['reason'] !== 'Ditolak') {
                    $text .= ' - ' . $callData['reason'];
                }
                break;
            case 'missed':    
                $text .= ' • Tak terjawab'; 
                break;
            case 'accepted':  
                $text .= ' • Diterima'; 
                break;
            case 'ended':
                if (!empty($callData['duration']) && $callData['duration'] > 0) {
                    $text .= ' • ' . $this->formatDuration($callData['duration']);
                } else {
                    $text .= ' • Selesai';
                }
                break;
            default:
                $text .= ' • Selesai';
        }

        return $text;
    }

    /**
     * ✅ HELPER: Format duration
     */
    private function formatDuration(int $seconds): string
    {
        if ($seconds < 60) {
            return "{$seconds} dtk";
        }
        
        $minutes = floor($seconds / 60);
        $remainingSeconds = $seconds % 60;
        
        if ($minutes < 60) {
            return $remainingSeconds > 0 
                ? "{$minutes} mnt {$remainingSeconds} dtk" 
                : "{$minutes} mnt";
        }
        
        $hours = floor($minutes / 60);
        $remainingMinutes = $minutes % 60;
        
        return $remainingMinutes > 0 
            ? "{$hours} jam {$remainingMinutes} mnt" 
            : "{$hours} jam";
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

        // ✅ BUAT PESAN CALL EVENT UNTUK GRUP
        foreach ($allMembers as $member) {
            if ($member->id !== $caller->id) {
                $this->createGroupCallEventMessage(
                    groupId: $group->id,
                    callerId: $caller->id,
                    status: 'calling',
                    duration: null,
                    channel: $channel
                );
            }
        }

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

    // ✅ PERBAIKAN KRITIS: Load relasi profile_photo_url sebelum broadcast
    // Pastikan User model memiliki accessor profile_photo_url
    $user->load([]); // Trigger accessor jika ada
    
    Log::info('✅ User data before broadcast:', [
        'user_id' => $user->id,
        'user_name' => $user->name,
        'profile_photo_url' => $user->profile_photo_url, // ✅ Verifikasi data ada
        'accepted' => $request->accepted
    ]);

    // ✅ BUAT PESAN CALL EVENT UNTUK GRUP
    if ($request->accepted) {
        $this->createGroupCallEventMessage(
            groupId: $group->id,
            callerId: $user->id,
            status: 'accepted',
            duration: null,
            channel: 'group-call-' . $request->call_id
        );
    } else {
        $this->createGroupCallEventMessage(
            groupId: $group->id,
            callerId: $user->id,
            status: 'rejected',
            duration: null,
            channel: 'group-call-' . $request->call_id,
            reason: $request->reason
        );
    }

    // ✅ TUTUP NOTIFIKASI JIKA DIJAWAB
    if ($request->accepted) {
        $this->closeCallNotification($request->call_id, 'group', $user->id);
    }

    // ✅ BROADCAST dengan data user yang LENGKAP
    event(new GroupCallAnswered(
        $request->call_id, 
        $group, 
        $user, // User model dengan accessor profile_photo_url sudah ter-load
        $request->boolean('accepted'), 
        $request->reason
    ));
    
    return response()->json(['status' => 'success']);
}

    public function endGroupCall(Request $request) 
{
    try {
        // 1. Validasi
        $request->validate([
            'call_id' => 'required|string', 
            'group_id' => 'required|exists:groups,id',
            'reason' => 'nullable|string'
        ]);
        
        $user = $request->user();
        $groupId = $request->group_id;
        $callId = $request->call_id;
        $reason = $request->reason ?? 'Panggilan dibubarkan oleh host';
        
        Log::info('📞 [END GROUP CALL] Request received', [
            'call_id' => $callId,
            'group_id' => $groupId,
            'user_id' => $user->id,
            'user_name' => $user->name,
            'reason' => $reason
        ]);

        // 2. Cari grup
        $group = Group::with('members')->find($groupId);
        
        if (!$group) {
            Log::warning('Group not found', ['group_id' => $groupId]);
            return response()->json([
                'status' => 'error',
                'message' => 'Grup tidak ditemukan'
            ], 404);
        }
        
        // 3. Dapatkan semua member grup
        $allMembers = $group->members->pluck('id')->toArray();
        
        // ✅ PERBAIKAN: Tambahkan log detail
        Log::info('👥 [END GROUP CALL] Group members found:', [
            'group_id' => $groupId,
            'group_name' => $group->name,
            'member_count' => count($allMembers),
            'member_ids' => $allMembers,
            'host_id' => $user->id
        ]);
        
        // ✅ PERBAIKAN: Pastikan host termasuk dalam list member jika perlu
        if (!in_array($user->id, $allMembers)) {
            $allMembers[] = $user->id;
            Log::info('➕ [END GROUP CALL] Added host to member list:', ['host_id' => $user->id]);
        }
        
        // 4. ✅ PERBAIKAN BESAR: Gunakan broadcast() bukan event()
        // Event harus di-broadcast menggunakan Laravel Echo
        broadcast(new GroupCallEnded(
            $user->id,                    // userId (siapa yang mengakhiri)
            $groupId,                     // groupId
            $callId,                      // callId
            $reason,                      // reason
            0,                            // duration
            $allMembers,                  // semua member yang akan menerima event
            $user                         // endedBy (data user lengkap)
        ));
        
        // 5. ✅ TUTUP NOTIFIKASI untuk semua member
        foreach ($allMembers as $memberId) {
            $this->closeCallNotification($callId, 'group', $memberId);
        }
        
        Log::info('✅ [END GROUP CALL] Event broadcasted successfully', [
            'call_id' => $callId,
            'group_id' => $groupId,
            'ended_by_id' => $user->id,
            'ended_by_name' => $user->name,
            'broadcast_to_members' => count($allMembers),
            'member_ids' => $allMembers,
            'reason' => $reason
        ]);

        // 6. Response sukses
        return response()->json([
            'status' => 'success',
            'message' => 'Panggilan grup berhasil dibubarkan',
            'call_id' => $callId,
            'ended_by' => [
                'id' => $user->id,
                'name' => $user->name
            ],
            'broadcast_to' => count($allMembers) . ' members'
        ]);

    } catch (\Exception $e) {
        Log::error('❌ [END GROUP CALL] Error: ' . $e->getMessage(), [
            'error_trace' => $e->getTraceAsString(),
            'request' => $request->all()
        ]);
        
        return response()->json([
            'status' => 'error',
            'message' => 'Gagal membubarkan panggilan grup: ' . $e->getMessage()
        ], 500);
    }
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
     * ✅ METHOD BARU: Buat pesan call event untuk personal call
     */
    // file: app/Http/Controllers/AgoraCallController.php

// file: app/Http/Controllers/AgoraCallController.php

// private function createOrUpdateCallEventAndMessage($channel, $callerId, $calleeId, $status, $callType = 'voice', $duration = null, $reason = null)
// {
//     try {
//         DB::beginTransaction(); // <-- Tambahkan transaksi untuk keamanan data

//         // Cari atau buat CallEvent berdasarkan channel yang unik
//         $callEvent = CallEvent::firstOrNew(['channel' => $channel]);

//         // Isi atau update data CallEvent
//         $callEvent->caller_id = $callEvent->caller_id ?? $callerId;
//         $callEvent->callee_id = $callEvent->callee_id ?? $calleeId;
//         $callEvent->call_type = $callEvent->call_type ?? $callType;
//         $callEvent->status = $status;
//         if ($duration !== null) $callEvent->duration = $duration;
//         if ($reason !== null) $callEvent->reason = $reason;
//         $callEvent->save();

//         // --- PERUBAHAN UTAMA DI SINI ---
//         // Gunakan relasi untuk mencari atau membuat ChatMessage.
//         // Ini menjamin hanya ada SATU chat message per call event.
//         $chatMessage = $callEvent->chatMessage()->firstOrCreate(
//             [], // Tidak perlu kondisi pencarian tambahan
//             [   // Data ini hanya akan digunakan jika message BARU dibuat
//                 'sender_id' => $callerId,
//                 'receiver_id' => $calleeId,
//                 'type' => 'call_event',
//                 'message' => '...'
//             ]
//         );
        
//         // Ambil teks status terbaru dari model CallEvent
//         $updatedText = $callEvent->getCallMessageText();
        
//         // Update kolom 'message' di tabel chat_messages
//         $chatMessage->update(['message' => $updatedText]);
        
//         // Muat relasi untuk broadcast
//         $chatMessage->load('sender', 'callEvent');

//         // Broadcast HANYA SEKALI ke semua channel (termasuk pengirim)
//         broadcast(new MessageSent($chatMessage));

//         Log::info("Call event state changed", [
//             'channel' => $channel, 
//             'status' => $status,
//             'message_id' => $chatMessage->id,
//             'caller_id' => $callerId,
//             'callee_id' => $calleeId
//         ]);
        
//         DB::commit(); // <-- Selesaikan transaksi

//         return $callEvent->setRelation('chatMessage', $chatMessage);

//     } catch (\Exception $e) {
//         DB::rollBack(); // <-- Batalkan jika ada error
//         Log::error('Failed to create or update call event message: ' . $e->getMessage());
//         return null;
//     }
// }
//     /**
//      * ✅ METHOD BARU: Buat pesan call event untuk group call
//      */
//     private function createGroupCallEventMessage($groupId, $callerId, $status, $duration, $channel, $reason = null)
//     {
//         try {
//             $text = 'Panggilan Grup Suara';
            
//             switch ($status) {
//                 case 'calling':
//                     $text .= ' • Memanggil';
//                     break;
//                 case 'accepted':
//                     $text .= ' • Diterima';
//                     break;
//                 case 'rejected':
//                     $text .= ' • Ditolak';
//                     if ($reason) {
//                         $text .= ' - ' . $reason;
//                     }
//                     break;
//                 case 'ended':
//                     $text .= ' • Selesai';
//                     if ($duration > 0) {
//                         $text .= ' - ' . $this->formatDuration($duration);
//                     }
//                     break;
//                 default:
//                     $text .= ' • Selesai';
//             }

//             // Untuk group message, kita perlu membuat struktur yang sesuai
//             // Ini adalah simplified version - sesuaikan dengan model group message Anda
//             $message = ChatMessage::create([
//                 'sender_id' => $callerId,
//                 'group_id' => $groupId,
//                 'type' => 'call_event',
//                 'message' => $text,
//                 'created_at' => now()
//             ]);

//             // Load relationship untuk broadcast
//             $message->load('sender');

//             // Broadcast message ke group chat
//             // Sesuaikan dengan event group message Anda
//             broadcast(new MessageSent($message));

//             Log::info('Group call event message created', [
//                 'group_id' => $groupId,
//                 'caller_id' => $callerId,
//                 'status' => $status,
//                 'message' => $text,
//                 'message_id' => $message->id
//             ]);

//             return $message;

//         } catch (\Exception $e) {
//             Log::error('Failed to create group call event message: ' . $e->getMessage());
//             return null;
//         }
//     }

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

    /**
     * ✅ HELPER: Format durasi panggilan dengan format yang diinginkan
     */
    public function formatDurationForPublic($seconds)
    {
        if ($seconds === null) return '';
        if ($seconds < 60) return "{$seconds} dtk";
        $minutes = floor($seconds / 60);
        $remainingSeconds = $seconds % 60;
        if ($minutes < 60) {
            return $remainingSeconds > 0 ? "{$minutes} mnt {$remainingSeconds} dtk" : "{$minutes} mnt";
        }
        $hours = floor($minutes / 60);
        $remainingMinutes = $minutes % 60;
        return $remainingMinutes > 0 ? "{$hours} jam {$remainingMinutes} mnt" : "{$hours} jam";
    }
}
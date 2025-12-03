<?php

namespace App\Http\Controllers;

use App\Events\CallSignal;
use Illuminate\Http\Request;
use App\Events\CallInitiated;
use App\Events\CallEnded;
use App\Events\GroupCallInitiated;
use App\Events\GroupCallAccepted;
use App\Events\GroupCallEnded;
use Illuminate\Support\Facades\Log;

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

    // Group call invite
    public function groupInvite(Request $request)
    {
        try {
            $validated = $request->validate([
                'group_id' => 'required|integer',
                'group_name' => 'required|string',
                'call_type' => 'required|in:voice,video',
                'members' => 'required|array',
                'members.*' => 'exists:users,id'
            ]);

            $callId = uniqid('group_call_');
            $caller = auth()->user();

            // Broadcast ke SEMUA anggota grup (kecuali caller)
            foreach ($validated['members'] as $memberId) {
                broadcast(new GroupCallInitiated(
                    $caller,
                    $memberId,
                    $validated['group_id'],
                    $validated['group_name'],
                    $validated['call_type'],
                    $callId,
                    $validated['members']
                ))->toOthers();
            }

            Log::info('Group call initiated', [
                'call_id' => $callId,
                'caller' => $caller->id,
                'group' => $validated['group_id'],
                'members' => $validated['members']
            ]);

            return response()->json([
                'success' => true,
                'call_id' => $callId,
                'message' => 'Group call broadcasted to all members'
            ]);
        } catch (\Exception $e) {
            Log::error('Group call invite error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => $e->getMessage()
            ], 500);
        }
    }

    // Group Call Accept
    public function groupAccept(Request $request)
    {
        try {
            $validated = $request->validate([
                'call_id' => 'required|string',
                'group_id' => 'required|integer',
                'caller_id' => 'required|exists:users,id'
            ]);

            $accepter = auth()->user();

            // ambil semua member Ids dari group
            $group = \App\Models\Group::with('members')->find($validated['group_id']);
            $memberIds = $group->members->pluck('id')->toArray();

            // Broadcast ke caller dan semua anggota lain
            broadcast(new GroupCallAccepted(
                $accepter,
                $validated['group_id'],
                $validated['call_id'],
                $memberIds
            ));

            return response()->json(['success' => true]);
        } catch (\Exception $e) {
            Log::error('Group call accept error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => $e->getMessage()
            ], 500);
        }
    }

    // Group Call Reject
    public function groupReject(Request $request)
    {
        try {
            $validated = $request->validate([
                'call_id' => 'required|string',
                'group_id' => 'required|integer'
            ]);

            $rejecter = auth()->user();

            broadcast(new GroupCallEnded(
                $rejecter->id,
                $validated['group_id'],
                $validated['call_id'],
                'rejected'
            ));

            return response()->json(['success' => true]);
        } catch (\Exception $e) {
            Log::error('Group call reject error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => $e->getMessage()
            ], 500);
        }
    }

    // Group Call End
    public function groupEnd(Request $request)
    {
        try {
            $validated = $request->validate([
                'call_id' => 'required|string',
                'group_id' => 'required|integer',
                'duration' => 'nullable|integer'
            ]);

            // ambil semua member Ids dari group
            $group = \App\Models\Group::with('members')->find($validated['group_id']);
            $memberIds = $group->members->pluck('id')->toArray();

            broadcast(new GroupCallEnded(
                auth()->id(),
                $validated['group_id'],
                $validated['call_id'],
                'ended',
                $validated['duration'] ?? 0,
                $memberIds
            ));

            return response()->json(['success' => true]);
        } catch (\Exception $e) {
            Log::error('Group call end error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => $e->getMessage()
            ], 500);
        }
    }
}

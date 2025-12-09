<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('chat_messages', function (Blueprint $table) {
            // Tambah kolom JSON untuk menyimpan data call
            $table->json('call_data')->nullable()->after('message');
            
            // Tambah index untuk performa query
            $table->index('type');
        });

        // Optional: Migrate existing call_event data dari CallEvent ke call_data
        // Uncomment jika Anda ingin migrasi data lama
        /*
        if (Schema::hasTable('call_events')) {
            DB::table('chat_messages')
                ->where('type', 'call_event')
                ->whereNotNull('call_event_id')
                ->get()
                ->each(function ($message) {
                    $callEvent = DB::table('call_events')
                        ->where('id', $message->call_event_id)
                        ->first();
                    
                    if ($callEvent) {
                        DB::table('chat_messages')
                            ->where('id', $message->id)
                            ->update([
                                'call_data' => json_encode([
                                    'call_id' => 'migrated_' . $callEvent->id,
                                    'channel' => $callEvent->channel,
                                    'status' => $callEvent->status,
                                    'call_type' => $callEvent->call_type,
                                    'duration' => $callEvent->duration,
                                    'reason' => $callEvent->reason,
                                ])
                            ]);
                    }
                });
        }
        */
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('chat_messages', function (Blueprint $table) {
            $table->dropColumn('call_data');
            $table->dropIndex(['type']);
        });
    }
};
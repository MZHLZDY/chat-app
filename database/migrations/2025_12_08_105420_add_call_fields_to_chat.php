<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('chat_messages', function (Blueprint $table) {
            // Tambah kolom untuk call metadata
            $table->string('call_channel')->nullable()->after('type');
            $table->enum('call_type', ['voice', 'video'])->nullable()->after('call_channel');
            $table->enum('call_status', ['calling', 'accepted', 'rejected', 'missed', 'ended', 'cancelled'])->nullable()->after('call_type');
            $table->integer('call_duration')->nullable()->after('call_status'); // dalam detik
            $table->string('call_reason')->nullable()->after('call_duration');
            
            // Index untuk performa query
            $table->index('call_channel');
        });
    }

    public function down(): void
    {
        Schema::table('chat_messages', function (Blueprint $table) {
            $table->dropIndex(['call_channel']);
            $table->dropColumn([
                'call_channel',
                'call_type', 
                'call_status',
                'call_duration',
                'call_reason'
            ]);
        });
    }
};
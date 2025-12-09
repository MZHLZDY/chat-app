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
        // Cek apakah kolom sudah ada
        if (!Schema::hasColumn('chat_messages', 'call_data')) {
            Schema::table('chat_messages', function (Blueprint $table) {
                $table->json('call_data')->nullable()->after('message');
                
                // Tambah index untuk performa
                $table->index('type');
            });
            
            echo "✅ Kolom 'call_data' berhasil ditambahkan\n";
        } else {
            echo "⚠️ Kolom 'call_data' sudah ada, skip...\n";
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasColumn('chat_messages', 'call_data')) {
            Schema::table('chat_messages', function (Blueprint $table) {
                $table->dropColumn('call_data');
                
                // Drop index jika ada
                try {
                    $table->dropIndex(['type']);
                } catch (\Exception $e) {
                    // Ignore jika index tidak ada
                }
            });
        }
    }
};
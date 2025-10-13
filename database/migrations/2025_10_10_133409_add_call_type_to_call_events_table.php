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
        Schema::table('call_events', function (Blueprint $table) {
            // Tambahkan kolom call_type setelah kolom status
            $table->string('call_type')->default('voice')->after('status');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('call_events', function (Blueprint $table) {
            $table->dropColumn('call_type');
        });
    }
};
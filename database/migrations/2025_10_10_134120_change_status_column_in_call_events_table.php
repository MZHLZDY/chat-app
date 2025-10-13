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
            // Mengubah kolom 'status' menjadi string dengan panjang 20
            $table->string('status', 20)->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('call_events', function (Blueprint $table) {
            // Ini adalah tindakan kebalikan, mungkin perlu disesuaikan 
            // dengan tipe data kolom Anda sebelumnya jika ingin bisa di-rollback.
            // Untuk amannya, kita bisa set ke panjang default yang sama.
            $table->string('status', 20)->change();
        });
    }
};
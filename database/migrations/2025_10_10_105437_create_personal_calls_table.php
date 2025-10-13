<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('personal_calls', function (Blueprint $table) {
            $table->id();
            $table->string('call_id')->unique(); // ID unik dari panggilan
            $table->string('channel_name')->unique(); // Nama channel Agora
            $table->foreignId('caller_id')->constrained('users')->onDelete('cascade');
            $table->foreignId('callee_id')->constrained('users')->onDelete('cascade');
            $table->enum('status', ['calling', 'accepted', 'rejected', 'ended', 'missed', 'cancelled']);
            $table->string('call_type', 20)->default('voice'); // voice atau video
            $table->timestamp('started_at')->nullable();
            $table->timestamp('ended_at')->nullable();
            $table->integer('duration_seconds')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('personal_calls');
    }
};
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
       Schema::create('chat_messages', function (Blueprint $table) {
        $table->id();
        $table->foreignId('sender_id')->constrained('users')->onDelete('cascade');
        $table->foreignId('receiver_id')->nullable()->constrained('users')->onDelete('cascade');
        $table->text('message')->nullable();
        $table->string('type')->default('text');
        $table->string('file_path')->nullable();
        $table->string('file_name')->nullable();
        $table->string('file_mime_type')->nullable();
        $table->integer('file_size')->nullable();
        $table->softDeletes();
        $table->timestamps();
    });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('chat_messages');
    }
};

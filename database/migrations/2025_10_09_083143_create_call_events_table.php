<?php
// database/migrations/2024_01_01_000000_create_call_events_table.php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateCallEventsTable extends Migration
{
    public function up()
    {
        Schema::create('call_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('caller_id')->constrained('users');
            $table->foreignId('callee_id')->constrained('users');
            $table->enum('type', ['voice_call', 'video_call']);
            $table->enum('status', ['answered', 'missed', 'cancelled', 'rejected']);
            $table->integer('duration')->nullable();
            $table->string('channel')->nullable();
            $table->timestamps();   
            $table->index(['caller_id', 'callee_id']);
            $table->index('created_at');
        });
    }

    public function down()
    {
        Schema::dropIfExists('call_events');
    }
}
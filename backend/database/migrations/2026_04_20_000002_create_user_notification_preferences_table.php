<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Creates the user_notification_preferences table.
 *
 * Every column defaults to FALSE — users are opted out of all email
 * notifications by default and must explicitly enable each one.
 * A row is created on first GET (firstOrCreate), so the table starts empty.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('user_notification_preferences', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')
                  ->constrained()
                  ->cascadeOnDelete()
                  ->unique(); // one row per user

            // Schema interaction notifications
            $table->boolean('starred_schema')->default(false);
            $table->boolean('liked_schema')->default(false);
            $table->boolean('forked_schema')->default(false);
            $table->boolean('commented_schema')->default(false);

            // Social notifications
            $table->boolean('friend_request_received')->default(false);
            $table->boolean('friend_request_accepted')->default(false);

            // Collaboration notification
            $table->boolean('collaboration_invited')->default(false);

            // Platform announcement
            $table->boolean('schema_of_the_week')->default(false);

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_notification_preferences');
    }
};

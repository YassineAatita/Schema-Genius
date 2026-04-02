<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('schema_comments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            // Self-referential for one level of threaded replies.
            // parent_id = null → top-level comment; parent_id set → reply.
            $table->foreignId('parent_id')
                  ->nullable()
                  ->constrained('schema_comments')
                  ->cascadeOnDelete();
            $table->text('content');
            $table->timestamps();

            $table->index(['project_id', 'parent_id']); // fast comment thread fetches
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('schema_comments');
    }
};

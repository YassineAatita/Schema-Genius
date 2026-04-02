<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Tracks the fork genealogy for "Schema DNA".
        // original_project_id → the project that was forked (may itself be a fork).
        // forked_project_id   → the new project created as a result of the fork.
        // Traversing this table from any project back to a root gives the DNA lineage.
        Schema::create('project_forks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('original_project_id')->constrained('projects')->cascadeOnDelete();
            $table->foreignId('forked_project_id')->constrained('projects')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete(); // who forked
            $table->timestamp('created_at')->useCurrent();

            $table->unique('forked_project_id'); // a project can only be a fork of one original
            $table->index('original_project_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('project_forks');
    }
};

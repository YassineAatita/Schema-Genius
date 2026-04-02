<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // One featured schema per week, chosen by an admin.
        // week_of is a Monday date (YYYY-MM-DD) used as the unique week identifier.
        Schema::create('featured_schemas', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained()->cascadeOnDelete();
            $table->foreignId('featured_by')->constrained('users')->cascadeOnDelete();
            $table->date('week_of')->unique(); // one feature per calendar week
            $table->string('note', 500)->nullable(); // admin's note on why it was picked
            $table->timestamp('created_at')->useCurrent();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('featured_schemas');
    }
};

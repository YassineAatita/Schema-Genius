<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('schema_versions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('schema_id')->constrained()->cascadeOnDelete();
            $table->smallInteger('version_number')->default(1);
            $table->string('label', 100)->nullable();
            $table->json('schema_json');
            $table->foreignId('created_by')->constrained('users');
            $table->timestamp('created_at')->useCurrent();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('schema_versions');
    }
};
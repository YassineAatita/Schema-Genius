<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Add is_visible boolean to featured_schemas so admins can hide the
     * Schema of the Week banner without deleting the featured record.
     * Default TRUE ensures all existing rows stay visible after the migration.
     */
    public function up(): void
    {
        Schema::table('featured_schemas', function (Blueprint $table) {
            $table->boolean('is_visible')->default(true)->after('note');
        });
    }

    public function down(): void
    {
        Schema::table('featured_schemas', function (Blueprint $table) {
            $table->dropColumn('is_visible');
        });
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Make featured_by nullable so the system can auto-select a Schema of the Week
     * without requiring an admin to be the author of the pick.
     */
    public function up(): void
    {
        Schema::table('featured_schemas', function (Blueprint $table) {
            // Drop the old NOT NULL foreign key constraint first
            $table->dropForeign(['featured_by']);
            // Re-add as nullable with the same cascade behaviour
            $table->unsignedBigInteger('featured_by')->nullable()->change();
            $table->foreign('featured_by')->references('id')->on('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('featured_schemas', function (Blueprint $table) {
            $table->dropForeign(['featured_by']);
            $table->unsignedBigInteger('featured_by')->nullable(false)->change();
            $table->foreign('featured_by')->references('id')->on('users')->cascadeOnDelete();
        });
    }
};

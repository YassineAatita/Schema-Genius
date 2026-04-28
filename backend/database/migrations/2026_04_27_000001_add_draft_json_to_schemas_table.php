<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('schemas', function (Blueprint $table) {
            // Stores the most recent auto-saved canvas state.
            // Kept separate from schema_versions so auto-saves never pollute
            // the named version history. Loaded preferentially over the last
            // saved version when the designer opens.
            $table->json('draft_json')->nullable()->after('current_version_id');
        });
    }

    public function down(): void
    {
        Schema::table('schemas', function (Blueprint $table) {
            $table->dropColumn('draft_json');
        });
    }
};

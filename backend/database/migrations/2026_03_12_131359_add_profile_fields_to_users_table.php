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
        Schema::table('users', function (Blueprint $table) {
            $table->enum('user_type', ['student', 'developer', 'designer', 'fullstack', 'other'])
                  ->default('developer')->after('name');
            $table->string('headline', 120)->nullable()->after('user_type');
            $table->text('bio')->nullable()->after('headline');
            $table->string('avatar_url')->nullable()->after('bio');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['user_type', 'headline', 'bio', 'avatar_url']);
        });
    }
};

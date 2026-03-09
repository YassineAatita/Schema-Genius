<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SchemaVersion extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'schema_id',
        'version_number',
        'label',
        'schema_json',
        'created_by',
        'created_at',
    ];

    protected function casts(): array
    {
        return [
            'schema_json' => 'array',  // Auto decode JSON to PHP array
            'created_at'  => 'datetime',
        ];
    }

    public function schema()
    {
        return $this->belongsTo(Schema::class);
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
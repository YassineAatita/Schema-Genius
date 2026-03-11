<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Schema;
use App\Models\SchemaVersion;
use Illuminate\Http\Request;


class SchemaController extends Controller
{
    // GET /api/schemas/{id}
    public function show($id)
    {
        $schema = Schema::with('currentVersion')->findOrFail($id);
        return response()->json($schema);
    }

    // PUT /api/schemas/{id}
    public function update(Request $request, $id)
    {
        $schema = Schema::findOrFail($id);

        $validated = $request->validate([
            'schema_json'        => 'required|array',
            'schema_json.nodes'  => 'required|array',
            'schema_json.edges'  => 'required|array',
            'label'              => 'nullable|string|max:100',
        ]);

        // Get the next version number
        $lastVersion = SchemaVersion::where('schema_id', $schema->id)
            ->max('version_number') ?? 0;

        // Save a new version
        $version = SchemaVersion::create([
            'schema_id'      => $schema->id,
            'version_number' => $lastVersion + 1,
            'label'          => $validated['label'] ?? null,
            'schema_json'    => $validated['schema_json'],
            'created_by'     => $request->user()->id,
        ]);

        // Update current version pointer
        $schema->update(['current_version_id' => $version->id]);

        return response()->json([
            'message' => 'Schema saved successfully.',
            'version' => $version,
        ]);
    }

    public function exportSql($id, Request $request)
    {
        $schema = Schema::with('currentVersion')->findOrFail($id);

        if (!$schema->currentVersion) {
            return response()->json([
                'message' => 'No saved version found. Please save your schema first.'
            ], 404);
        }

        $schemaJson = $schema->currentVersion->schema_json;

        // Generate SQL
        $generator = new \App\Services\SqlGeneratorService();
        $sql       = $generator->generate($schemaJson);

        // Clean filename
        $filename = 'schema_' . $id . '_' . now()->format('Ymd_His') . '.sql';

        // Return as downloadable file
        return response($sql, 200)
            ->header('Content-Type', 'text/plain')
            ->header('Content-Disposition', "attachment; filename=\"{$filename}\"");
    }

}
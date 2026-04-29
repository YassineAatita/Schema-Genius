<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Project;
use App\Models\Schema;
use App\Models\SchemaVersion;
use Illuminate\Http\Request;


class SchemaController extends Controller
{
    // GET /api/schemas/{id}
    public function show($id)
    {
        $schema = Schema::with('currentVersion')->findOrFail($id);

        // Authorization: only owner or an accepted collaborator may read this schema
        $this->authorizeSchemaAccess($schema);

        return response()->json($schema);
    }

    // PUT /api/schemas/{id}
    public function update(Request $request, $id)
    {
        $schema  = Schema::findOrFail($id);
        $user    = $request->user();
        $project = $schema->project;

        // Only owners and editors can save
        $isOwner  = $project->owner_id === $user->id;
        $isEditor = $project->collaborators()
            ->where('users.id', $user->id)
            ->wherePivot('role', 'editor')
            ->wherePivot('status', 'accepted')
            ->exists();

        if (!$isOwner && !$isEditor) {
            return response()->json(['error' => 'Viewers cannot save changes.'], 403);
        }

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

    // GET /api/schemas/{id}/versions
    public function versions($id)
    {
        $schema = Schema::with(['versions.creator'])->findOrFail($id);

        // Authorization: owner or collaborator
        $user    = auth()->user();
        $project = $schema->project;

        $isOwner        = $project->owner_id === $user->id;
        $isCollaborator = $project->collaborators()
            ->where('users.id', $user->id)
            ->wherePivot('status', 'accepted')
            ->exists();

        if (!$isOwner && !$isCollaborator) {
            return response()->json(['error' => 'Forbidden'], 403);
        }

        return response()->json(
            $schema->versions->map(fn($v) => [
                'id'             => $v->id,
                'version_number' => $v->version_number,
                'label'          => $v->label,
                'created_at'     => $v->created_at,
                'created_by'     => $v->creator?->name ?? 'Unknown',
                'is_current'     => $v->id === $schema->current_version_id,
                'schema_json'    => $v->schema_json,
            ])
        );
    }

    // POST /api/schemas/{id}/versions/{versionId}/restore
    public function restoreVersion($id, $versionId)
    {
        $schema = Schema::findOrFail($id);

        // Authorization: owner or editor
        $user    = auth()->user();
        $project = $schema->project;

        $isOwner  = $project->owner_id === $user->id;
        $isEditor = $project->collaborators()
            ->where('users.id', $user->id)
            ->wherePivot('role', 'editor')
            ->wherePivot('status', 'accepted')
            ->exists();

        if (!$isOwner && !$isEditor) {
            return response()->json(['error' => 'Forbidden'], 403);
        }

        $version = SchemaVersion::where('schema_id', $id)->findOrFail($versionId);

        // Point current_version_id at the restored version
        $schema->update(['current_version_id' => $version->id]);

        return response()->json([
            'message'     => 'Version restored successfully.',
            'schema_json' => $version->schema_json,
            'version'     => [
                'id'             => $version->id,
                'version_number' => $version->version_number,
                'label'          => $version->label,
                'created_at'     => $version->created_at,
            ],
        ]);
    }

    // PATCH /api/schemas/{id}/autosave
    // Silently writes draft_json without creating a version record.
    // Only callable by owners and editors (same auth as update()).
    public function autosave(Request $request, $id)
    {
        $schema  = Schema::findOrFail($id);
        $user    = $request->user();
        $project = $schema->project;

        $isOwner  = $project->owner_id === $user->id;
        $isEditor = $project->collaborators()
            ->where('users.id', $user->id)
            ->wherePivot('role', 'editor')
            ->wherePivot('status', 'accepted')
            ->exists();

        if (!$isOwner && !$isEditor) {
            return response()->json(['error' => 'Viewers cannot save changes.'], 403);
        }

        $validated = $request->validate([
            'schema_json'       => 'required|array',
            'schema_json.nodes' => 'required|array',
            'schema_json.edges' => 'required|array',
        ]);

        $schema->update(['draft_json' => $validated['schema_json']]);

        return response()->json(['ok' => true, 'saved_at' => now()->toIso8601String()]);
    }

    // GET /api/schemas/shared/{projectId}  — public, no auth required
    // Returns project info + the latest schema_json for a public project.
    public function shared($projectId)
    {
        $project = Project::with(['schema.currentVersion'])->findOrFail($projectId);

        if ($project->visibility !== 'public') {
            return response()->json(['error' => 'This project is private.'], 403);
        }

        $schema = $project->schema;
        // Prefer draft_json (most recent auto-save), fall back to last saved version
        $schemaJson = $schema?->draft_json
            ?? $schema?->currentVersion?->schema_json
            ?? ['nodes' => [], 'edges' => []];

        return response()->json([
            'project' => [
                'id'         => $project->id,
                'name'       => $project->name,
                'owner'      => $project->owner?->name ?? 'Unknown',
                'updated_at' => $project->updated_at,
            ],
            'schema_json' => $schemaJson,
        ]);
    }

    public function exportSql($id, Request $request)
    {
        $schema = Schema::with('currentVersion')->findOrFail($id);

        // Authorization: only owner or an accepted collaborator may export
        $this->authorizeSchemaAccess($schema);

        if (!$schema->currentVersion) {
            return response()->json([
                'message' => 'No saved version found. Please save your schema first.'
            ], 404);
        }

        $schemaJson = $schema->currentVersion->schema_json;

        // Generate SQL
        $dialect   = in_array($request->query('dialect'), ['mysql', 'postgresql', 'sqlite'])
                     ? $request->query('dialect')
                     : 'mysql';
        $generator = new \App\Services\SqlGeneratorService();
        $sql       = $generator->generate($schemaJson, $dialect);

        // Clean filename
        $filename = 'schema_' . $id . '_' . $dialect . '_' . now()->format('Ymd_His') . '.sql';

        // Return as downloadable file
        return response($sql, 200)
            ->header('Content-Type', 'text/plain')
            ->header('Content-Disposition', "attachment; filename=\"{$filename}\"");
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    /**
     * Abort with 403 unless the authenticated user is the project owner
     * or an accepted collaborator on the project that owns this schema.
     * Used by show() and exportSql() to prevent IDOR.
     */
    private function authorizeSchemaAccess(Schema $schema): void
    {
        $user    = auth()->user();
        $project = $schema->project;

        $isOwner        = $project->owner_id === $user->id;
        $isCollaborator = $project->collaborators()
            ->where('users.id', $user->id)
            ->wherePivot('status', 'accepted')
            ->exists();

        if (!$isOwner && !$isCollaborator) {
            abort(response()->json(['error' => 'You do not have access to this schema.'], 403));
        }
    }
}
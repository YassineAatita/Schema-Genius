<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AiGeneration;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

class AiController extends Controller
{
    public function generate(Request $request)
    {
        $request->validate([
            'prompt'     => 'required|string|max:1500',
            // project_id must belong to the requesting user (owner or editor)
            // to prevent polluting another user's AI generation stats.
            'project_id' => [
                'nullable',
                'integer',
                'exists:projects,id',
                function ($attribute, $value, $fail) use ($request) {
                    if (!$value) return;
                    $project = \App\Models\Project::find($value);
                    if (!$project) return;
                    $user      = $request->user();
                    $isOwner   = $project->owner_id === $user->id;
                    $isEditor  = $project->collaborators()
                        ->where('users.id', $user->id)
                        ->wherePivot('role', 'editor')
                        ->wherePivot('status', 'accepted')
                        ->exists();
                    if (!$isOwner && !$isEditor) {
                        $fail('You do not have access to the specified project.');
                    }
                },
            ],
        ]);

        $systemPrompt = <<<'PROMPT'
You are a database schema designer. When given a description, return ONLY valid JSON — no explanation, no markdown, no code blocks.

The JSON must follow this exact structure:
{
  "nodes": [
    {
      "id": "table_1",
      "type": "tableNode",
      "position": { "x": 80, "y": 80 },
      "data": {
        "name": "table_name",
        "columns": [
          {
            "id": "col_1",
            "name": "id",
            "type": "BIGINT",
            "nullable": false,
            "pk": true,
            "unique": true,
            "autoIncrement": true,
            "default": null,
            "fk": false
          }
        ]
      }
    }
  ],
  "edges": [
    {
      "id": "edge_1",
      "source": "table_1",
      "target": "table_2",
      "type": "smoothstep",
      "data": { "type": "1:N", "sourceLabel": "", "targetLabel": "" }
    }
  ]
}

Rules:
- Every table MUST have an "id" column (BIGINT, pk:true, autoIncrement:true, nullable:false, unique:true)
- Use sequential IDs: table_1, table_2 ... and col_1, col_2 ... (unique across all tables), edge_1, edge_2 ...
- Valid column types: BIGINT, INT, SMALLINT, VARCHAR, TEXT, LONGTEXT, BOOLEAN, DATE, DATETIME, TIMESTAMP, DECIMAL, FLOAT, ENUM
- Valid edge data.type values: "1:1", "1:N", "M:N"
- Position tables in a grid: x = 80 + (index % 3) * 380, y = 80 + floor(index / 3) * 300
- Use snake_case for all table and column names
- Foreign key columns (e.g. user_id referencing users) must have fk: true and type INT or BIGINT
- sourceLabel and targetLabel are optional human-readable role names (can be empty string "")
- Return ONLY the JSON object, nothing else
PROMPT;

        $response = Http::withHeaders([
            'Authorization' => 'Bearer ' . config('services.groq.api_key'),
            'Content-Type'  => 'application/json',
        ])->timeout(30)->post('https://api.groq.com/openai/v1/chat/completions', [
            'model'    => 'llama-3.3-70b-versatile',
            'messages' => [
                ['role' => 'system', 'content' => $systemPrompt],
                ['role' => 'user',   'content' => $request->prompt],
            ],
            'temperature' => 0.2,
            'max_tokens'  => 4096,
        ]);

        if (!$response->successful()) {
            return response()->json([
                'error' => 'AI service error: ' . $response->status(),
            ], 503);
        }

        $content = $response->json('choices.0.message.content') ?? '';

        // Strip markdown code fences if the model wraps the JSON
        $content = preg_replace('/^```(?:json)?\s*/im', '', $content);
        $content = preg_replace('/\s*```\s*$/im', '', $content);
        $content = trim($content);

        $schema = json_decode($content, true);

        if (json_last_error() !== JSON_ERROR_NONE || !isset($schema['nodes'])) {
            return response()->json([
                'error' => 'AI returned an invalid response. Please try rephrasing your description.',
            ], 422);
        }

        // Persist the generation so admin AI-usage monitoring has real data.
        // Wrapped in try/catch so a DB hiccup never breaks the generate response.
        $generationId = null;
        try {
            if ($request->user() && $request->input('project_id')) {
                $gen = AiGeneration::create([
                    'project_id'    => $request->input('project_id'),
                    'user_id'       => $request->user()->id,
                    'prompt'        => $request->input('prompt'),
                    'response_json' => $schema,
                    'applied'       => false,
                ]);
                $generationId = $gen->id;
            }
        } catch (\Throwable $e) {
            // Non-fatal — monitoring data loss is acceptable over blocking the user
        }

        return response()->json(array_merge($schema, ['generation_id' => $generationId]));
    }

    // POST /api/ai/generate-from-image
    public function generateFromImage(Request $request)
    {
        $request->validate([
            'image'      => 'required|string',   // base64 data URL
            'prompt'     => 'nullable|string|max:500',
            // project_id must belong to the requesting user (owner or editor)
            'project_id' => [
                'nullable',
                'integer',
                'exists:projects,id',
                function ($attribute, $value, $fail) use ($request) {
                    if (!$value) return;
                    $project = \App\Models\Project::find($value);
                    if (!$project) return;
                    $user     = $request->user();
                    $isOwner  = $project->owner_id === $user->id;
                    $isEditor = $project->collaborators()
                        ->where('users.id', $user->id)
                        ->wherePivot('role', 'editor')
                        ->wherePivot('status', 'accepted')
                        ->exists();
                    if (!$isOwner && !$isEditor) {
                        $fail('You do not have access to the specified project.');
                    }
                },
            ],
        ]);

        $dataUrl = $request->image;

        // Validate MIME type prefix — only allow known image formats
        $allowedPrefixes = [
            'data:image/jpeg;base64,',
            'data:image/jpg;base64,',
            'data:image/png;base64,',
            'data:image/gif;base64,',
            'data:image/webp;base64,',
            'data:image/bmp;base64,',
        ];
        $mimeValid = false;
        foreach ($allowedPrefixes as $prefix) {
            if (str_starts_with($dataUrl, $prefix)) {
                $mimeValid = true;
                break;
            }
        }
        if (!$mimeValid) {
            return response()->json(['error' => 'Invalid image format. Please upload a JPEG, PNG, GIF, or WebP image.'], 422);
        }

        // Accept data URLs or raw base64; enforce reasonable size (~4 MB base64 ≈ 3 MB image)
        if (strlen($dataUrl) > 5_000_000) {
            return response()->json(['error' => 'Image is too large. Please use an image under 3 MB.'], 422);
        }

        $systemPrompt = <<<'PROMPT'
You are a database schema designer. Analyse the provided image (which may be a hand-drawn ER diagram, a screenshot of tables, a whiteboard sketch, or any visual representation of a database schema).

Extract all tables and their columns, then return ONLY valid JSON — no explanation, no markdown, no code blocks.

The JSON must follow this exact structure:
{
  "nodes": [
    {
      "id": "table_1",
      "type": "tableNode",
      "position": { "x": 80, "y": 80 },
      "data": {
        "name": "table_name",
        "columns": [
          {
            "id": "col_1",
            "name": "id",
            "type": "BIGINT",
            "nullable": false,
            "pk": true,
            "unique": true,
            "autoIncrement": true,
            "default": null,
            "fk": false
          }
        ]
      }
    }
  ],
  "edges": [
    {
      "id": "edge_1",
      "source": "table_1",
      "target": "table_2",
      "type": "schema",
      "data": { "relationshipType": "1:M", "sourceLabel": "", "targetLabel": "", "lineStyle": "smoothstep", "diagramType": "association" }
    }
  ]
}

Rules:
- Every table MUST have an "id" column (BIGINT, pk:true, autoIncrement:true, nullable:false, unique:true) if not already visible
- Use sequential IDs: table_1, table_2 ... col_1, col_2 ... edge_1, edge_2 ...
- Valid column types: BIGINT, INT, SMALLINT, VARCHAR, TEXT, BOOLEAN, DATE, DATETIME, TIMESTAMP, DECIMAL, FLOAT
- Position tables in a grid: x = 80 + (index % 3) * 380, y = 80 + floor(index / 3) * 300
- Use snake_case for table and column names
- Foreign key columns must have fk: true
- Return ONLY the JSON object, nothing else
PROMPT;

        $userText = $request->prompt
            ? "Please analyse this image and convert it to a database schema. Additional context: " . $request->prompt
            : "Please analyse this image and convert it to a database schema.";

        $response = Http::withHeaders([
            'Authorization' => 'Bearer ' . config('services.groq.api_key'),
            'Content-Type'  => 'application/json',
        ])->timeout(60)->post('https://api.groq.com/openai/v1/chat/completions', [
            'model'    => 'meta-llama/llama-4-scout-17b-16e-instruct',
            'messages' => [
                ['role' => 'system', 'content' => $systemPrompt],
                [
                    'role'    => 'user',
                    'content' => [
                        ['type' => 'text',      'text'      => $userText],
                        ['type' => 'image_url', 'image_url' => ['url' => $dataUrl]],
                    ],
                ],
            ],
            'temperature' => 0.1,
            'max_tokens'  => 4096,
        ]);

        if (!$response->successful()) {
            return response()->json([
                'error' => 'AI vision service error: ' . $response->status(),
            ], 503);
        }

        $content = $response->json('choices.0.message.content') ?? '';
        $content = preg_replace('/^```(?:json)?\s*/im', '', $content);
        $content = preg_replace('/\s*```\s*$/im', '', $content);
        $content = trim($content);

        $schema = json_decode($content, true);

        if (json_last_error() !== JSON_ERROR_NONE || !isset($schema['nodes'])) {
            return response()->json([
                'error' => 'AI could not extract a schema from this image. Try a clearer image or add a description.',
            ], 422);
        }

        // Persist the generation record for admin monitoring
        $generationId = null;
        try {
            if ($request->user() && $request->input('project_id')) {
                $gen = AiGeneration::create([
                    'project_id'    => $request->input('project_id'),
                    'user_id'       => $request->user()->id,
                    'prompt'        => $request->input('prompt') ?? '[image upload]',
                    'response_json' => $schema,
                    'applied'       => false,
                ]);
                $generationId = $gen->id;
            }
        } catch (\Throwable $e) {
            // Non-fatal
        }

        return response()->json(array_merge($schema, ['generation_id' => $generationId]));
    }

    // POST /api/ai/enhance-bio
    public function enhanceBio(Request $request)
    {
        $request->validate([
            'bio'       => 'required|string|max:1000',
            'user_type' => 'nullable|string',
        ]);

        $userType = $request->user_type ?? 'developer';

        $systemPrompt = "You are a professional profile bio writer for a tech platform. " .
            "Given a rough bio from a {$userType}, rewrite it into a concise, engaging, " .
            "first-person professional bio (2-3 sentences, max 200 characters). " .
            "Keep the user's facts and tone. Return ONLY the improved bio text — no quotes, no explanation.";

        $response = Http::withHeaders([
            'Authorization' => 'Bearer ' . config('services.groq.api_key'),
            'Content-Type'  => 'application/json',
        ])->timeout(20)->post('https://api.groq.com/openai/v1/chat/completions', [
            'model'    => 'llama-3.3-70b-versatile',
            'messages' => [
                ['role' => 'system', 'content' => $systemPrompt],
                ['role' => 'user',   'content' => $request->bio],
            ],
            'temperature' => 0.6,
            'max_tokens'  => 120,
        ]);

        if (!$response->successful()) {
            return response()->json(['error' => 'AI service error.'], 503);
        }

        $enhanced = trim($response->json('choices.0.message.content') ?? '');

        return response()->json(['bio' => $enhanced]);
    }

    // POST /api/ai/suggest — analyse the current schema and return actionable suggestions
    public function suggest(Request $request)
    {
        $request->validate([
            'schema'             => 'required|array',
            // Cap nodes and edges to prevent sending enormous payloads to Groq
            'schema.nodes'       => 'sometimes|array|max:150',
            'schema.edges'       => 'sometimes|array|max:300',
            'project_id'         => 'nullable|exists:projects,id',
        ]);

        $schemaJson = json_encode($request->input('schema'), JSON_PRETTY_PRINT);

        $systemPrompt = <<<'PROMPT'
You are a senior database architect. Given a database schema in JSON format, analyse it and return ONLY valid JSON — no explanation, no markdown, no code blocks.

Return a JSON object with a single key "suggestions" — an array of suggestion objects.

Each suggestion object must follow this exact structure:
{
  "id": "s_1",
  "category": "index"|"nullability"|"timestamps"|"relationship"|"naming"|"junction",
  "title": "Short title (max 60 chars)",
  "description": "Clear explanation of WHY this matters (1-2 sentences)",
  "impact": "high"|"medium"|"low",
  "nodeId": "table_N",
  "tableName": "snake_case_name",
  "action": {
    "type": "add_index"|"set_not_null"|"add_timestamps"|"change_relationship"|"rename_column"|"add_junction_table",
    "columnName": "column_name_if_applicable",
    "newName": "new_name_if_rename",
    "relationshipType": "1:N"|"M:N"|"1:1",
    "edgeId": "edge_id_if_applicable"
  }
}

Rules:
- Return between 0 and 8 suggestions maximum (most impactful only)
- Focus on these categories:
  * "index" — FK columns without an index (e.g. user_id, order_id columns that likely need indexing)
  * "nullability" — columns that by convention should be NOT NULL but are nullable (e.g. name, title, email)
  * "timestamps" — tables missing created_at / updated_at columns
  * "relationship" — edge relationship types that look wrong (e.g. M:N without a junction table)
  * "naming" — table or column names not in snake_case (mixing camelCase, PascalCase, etc.)
  * "junction" — M:N relationships that need an explicit junction/pivot table
- Only suggest things that are genuinely useful — do NOT suggest things already present
- If the schema is well-designed, return { "suggestions": [] }
- Return ONLY the JSON object, nothing else
PROMPT;

        $response = Http::withHeaders([
            'Authorization' => 'Bearer ' . config('services.groq.api_key'),
            'Content-Type'  => 'application/json',
        ])->timeout(30)->post('https://api.groq.com/openai/v1/chat/completions', [
            'model'    => 'llama-3.3-70b-versatile',
            'messages' => [
                ['role' => 'system', 'content' => $systemPrompt],
                ['role' => 'user',   'content' => "Analyse this schema and return suggestions:\n\n" . $schemaJson],
            ],
            'temperature' => 0.2,
            'max_tokens'  => 2048,
        ]);

        if (!$response->successful()) {
            return response()->json([
                'error' => 'AI service error: ' . $response->status(),
            ], 503);
        }

        $content = $response->json('choices.0.message.content') ?? '';
        $content = preg_replace('/^```(?:json)?\s*/im', '', $content);
        $content = preg_replace('/\s*```\s*$/im', '', $content);
        $content = trim($content);

        $result = json_decode($content, true);

        if (json_last_error() !== JSON_ERROR_NONE || !isset($result['suggestions'])) {
            return response()->json([
                'error' => 'AI returned an unexpected response. Please try again.',
            ], 422);
        }

        return response()->json(['suggestions' => $result['suggestions']]);
    }

    // POST /api/ai/roast — brutally honest schema review from a senior DBA persona
    public function roast(Request $request)
    {
        $request->validate([
            'schema'       => 'required|array',
            // Cap nodes and edges to prevent sending enormous payloads to Groq
            'schema.nodes' => 'sometimes|array|max:150',
            'schema.edges' => 'sometimes|array|max:300',
        ]);

        $schemaJson = json_encode($request->input('schema'), JSON_PRETTY_PRINT);

        $systemPrompt = <<<'PROMPT'
You are a brutally honest senior database architect with a dry sense of humour. You have been given a database schema and your job is to roast it — find every genuine flaw, poor design decision, naming horror, missing constraint, or security risk, and call it out directly.

Return ONLY valid JSON — no explanation, no markdown, no code blocks.

Return a JSON object with a single key "roasts" — an array of roast objects.

Each roast must follow this exact structure:
{
  "id": "r_1",
  "severity": "critical",
  "title": "Short punchy title (max 60 chars)",
  "description": "Direct, honest explanation of the problem and why it matters. Be specific about which table or column. You can be slightly humorous but the critique must be technically accurate.",
  "table": "table_name_or_null"
}

Valid severity values: "critical" | "bad" | "meh"

Severity guide:
- "critical" — will break in production, security risk, or data loss risk (e.g. no PKs, text passwords, no referential integrity)
- "bad" — real design problem that will cause pain (e.g. missing indexes on FK columns, no timestamps, ambiguous or generic naming like "data" or "info")
- "meh" — minor style or convention issue worth fixing (e.g. inconsistent naming, unnecessary nullable columns, missing NOT NULL constraints on obvious fields)

Rules:
- Return between 0 and 10 roast items (most impactful only — quality over quantity)
- Be specific: name the exact table and column when relevant
- Do NOT make up problems that do not exist in the schema
- Do NOT roast the same issue twice in different wordings
- If the schema is genuinely well-designed, return { "roasts": [] }
- Return ONLY the JSON object, nothing else
PROMPT;

        $response = Http::withHeaders([
            'Authorization' => 'Bearer ' . config('services.groq.api_key'),
            'Content-Type'  => 'application/json',
        ])->timeout(30)->post('https://api.groq.com/openai/v1/chat/completions', [
            'model'    => 'llama-3.3-70b-versatile',
            'messages' => [
                ['role' => 'system', 'content' => $systemPrompt],
                ['role' => 'user',   'content' => "Roast this schema:\n\n" . $schemaJson],
            ],
            'temperature' => 0.5,
            'max_tokens'  => 2048,
        ]);

        if (!$response->successful()) {
            return response()->json([
                'error' => 'AI service error: ' . $response->status(),
            ], 503);
        }

        $content = $response->json('choices.0.message.content') ?? '';
        $content = preg_replace('/^```(?:json)?\s*/im', '', $content);
        $content = preg_replace('/\s*```\s*$/im', '', $content);
        $content = trim($content);

        $result = json_decode($content, true);

        if (json_last_error() !== JSON_ERROR_NONE || !isset($result['roasts'])) {
            return response()->json([
                'error' => 'AI returned an unexpected response. Please try again.',
            ], 422);
        }

        return response()->json(['roasts' => $result['roasts']]);
    }

    // PATCH /api/ai/generations/{id}/apply — mark a generation as applied to canvas
    public function markApplied(Request $request, $id)
    {
        // Scope to the current user so users can't mark each other's generations
        $generation = AiGeneration::where('id', $id)
            ->where('user_id', $request->user()->id)
            ->first();

        if ($generation) {
            $generation->update(['applied' => true]);
        }

        return response()->json(['ok' => true]);
    }
}

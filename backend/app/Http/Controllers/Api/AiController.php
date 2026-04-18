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
            'project_id' => 'nullable|exists:projects,id',
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
            'project_id' => 'nullable|exists:projects,id',
        ]);

        $dataUrl = $request->image;

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

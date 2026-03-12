<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

class AiController extends Controller
{
    public function generate(Request $request)
    {
        $request->validate(['prompt' => 'required|string|max:1500']);

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

        return response()->json($schema);
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
}

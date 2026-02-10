#!/usr/bin/env bun
/**
 * Voice Input Server (Stub)
 *
 * HTTP server on port 8889 that manages the voice input pipeline.
 * Mirrors the architecture of pai-voice-system's server on port 8888:
 *   - Voice Output (TTS): POST text → speak aloud   (port 8888)
 *   - Voice Input (STT):  POST start → listen → text (port 8889)
 *
 * Together they form a complete bidirectional voice loop.
 *
 * ## Endpoints
 *
 *   POST /start-listening  — Begin mic capture with the configured STT provider.
 *   POST /stop-listening   — End capture, transcribe, return text.
 *   GET  /status           — Server state, active provider, listening status.
 *   GET  /health           — Health check (mirrors voice output server pattern).
 *
 * ## Integration with Claude Code
 *
 * After transcription, the server pipes text into Claude Code:
 *
 *   ```bash
 *   # Option A: Direct CLI prompt
 *   claude --prompt "transcribed text here"
 *
 *   # Option B: Pipe into running session via stdin
 *   echo "transcribed text" | claude --continue
 *
 *   # Option C: Write to a named pipe that Claude reads
 *   echo "transcribed text" > /tmp/pai-voice-input.pipe
 *   ```
 *
 * The best integration method depends on Claude Code's IPC capabilities
 * at implementation time.
 */

// import { serve } from "bun";
// import type { VoiceInputConfig, STTProvider, TranscriptionResult } from "./types";

const PORT = 8889;

// TODO: Load configuration from voice-input.example.json or settings.json
// TODO: Initialize the selected STT provider based on config
// TODO: Initialize activation methods (wake word, hotkey)

/**
 * Server implementation skeleton.
 *
 * When implemented, this will use Bun.serve() with the same patterns
 * as the voice output server (CORS, rate limiting, JSON responses).
 */

// const server = serve({
//   port: PORT,
//   async fetch(req) {
//     const url = new URL(req.url);
//
//     // --- CORS (same pattern as voice output server) ---
//     const corsHeaders = {
//       "Access-Control-Allow-Origin": "http://localhost",
//       "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
//       "Access-Control-Allow-Headers": "Content-Type",
//     };
//
//     if (req.method === "OPTIONS") {
//       return new Response(null, { headers: corsHeaders, status: 204 });
//     }
//
//     // --- POST /start-listening ---
//     // Begin audio capture with the active STT provider.
//     if (url.pathname === "/start-listening" && req.method === "POST") {
//       // TODO: Call provider.startListening()
//       // TODO: Return { status: "listening", provider: provider.name }
//       return new Response(
//         JSON.stringify({ status: "error", message: "Not yet implemented" }),
//         { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 501 }
//       );
//     }
//
//     // --- POST /stop-listening ---
//     // Stop capture, run transcription, return text.
//     // Optionally auto-submit to Claude Code.
//     if (url.pathname === "/stop-listening" && req.method === "POST") {
//       // TODO: Call provider.stopListening()
//       // TODO: Get TranscriptionResult
//       // TODO: If config.autoSubmit, pipe text to Claude Code:
//       //   spawn('claude', ['--prompt', result.text])
//       // TODO: Return { status: "transcribed", text: result.text, confidence: result.confidence }
//       return new Response(
//         JSON.stringify({ status: "error", message: "Not yet implemented" }),
//         { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 501 }
//       );
//     }
//
//     // --- GET /status ---
//     // Current server and provider state.
//     if (url.pathname === "/status" && req.method === "GET") {
//       // TODO: Return {
//       //   server: "running",
//       //   provider: provider.name,
//       //   listening: provider.isListening,
//       //   wakeWord: { enabled: config.wakeWord.enabled, phrase: config.wakeWord.phrase },
//       //   hotkey: { enabled: config.hotkey.enabled, combo: config.hotkey.combo },
//       // }
//       return new Response(
//         JSON.stringify({ status: "stub", message: "Voice Input Server - not yet implemented" }),
//         { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
//       );
//     }
//
//     // --- GET /health ---
//     // Simple health check (mirrors voice output server).
//     if (url.pathname === "/health") {
//       return new Response(
//         JSON.stringify({
//           status: "healthy",
//           port: PORT,
//           service: "pai-voice-input",
//           version: "0.1.0",
//           implemented: false,
//         }),
//         { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
//       );
//     }
//
//     return new Response("Voice Input Server - POST /start-listening or /stop-listening", {
//       headers: corsHeaders,
//       status: 200,
//     });
//   },
// });
//
// console.log(`Voice Input Server running on port ${PORT}`);
// console.log(`POST to http://localhost:${PORT}/start-listening`);
// console.log(`POST to http://localhost:${PORT}/stop-listening`);

console.log("[pai-voice-input] Server stub loaded. Not yet functional.");
console.log("[pai-voice-input] See README.md for implementation roadmap.");

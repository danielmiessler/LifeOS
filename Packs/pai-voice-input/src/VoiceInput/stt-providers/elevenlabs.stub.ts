/**
 * ElevenLabs STT Provider (Stub)
 *
 * Uses ElevenLabs Speech-to-Text API for cloud-based transcription.
 * Mirrors the existing ElevenLabs TTS integration in pai-voice-system,
 * completing the bidirectional voice loop.
 *
 * ## Implementation Approach
 *
 * 1. Capture audio locally using `sox` or Web Audio API.
 * 2. Send audio to ElevenLabs STT endpoint via REST API.
 *    - POST /v1/speech-to-text with audio file in multipart/form-data.
 *    - Returns JSON with transcription text, language, and confidence.
 * 3. Supports both batch and streaming modes.
 *
 * ## Trade-offs
 *
 * - Pros: High accuracy, language detection, speaker diarization,
 *   consistent with existing ElevenLabs TTS integration.
 * - Cons: Requires API key and internet, per-minute billing,
 *   latency from network round-trip.
 *
 * ## Dependencies
 *
 * - ElevenLabs API key (same key used for TTS in pai-voice-system)
 * - `sox` for local audio capture (`brew install sox`)
 * - Network connectivity
 */

import { BaseSTTProvider, STTInitializationError, STTTranscriptionError } from "./provider.interface";
import type { TranscriptionResult } from "../types";

export class ElevenLabsSTTProvider extends BaseSTTProvider {
  readonly name = "elevenlabs-stt";

  // TODO: Load from ~/.env (same pattern as pai-voice-system server.ts)
  private apiKey: string | undefined;
  private apiUrl = "https://api.elevenlabs.io/v1/speech-to-text";

  async initialize(): Promise<void> {
    // TODO: Load ELEVENLABS_API_KEY from ~/.env
    // TODO: Verify API key is present
    // TODO: Optionally ping the API to confirm key is valid
    // TODO: Set this.isInitialized = true
    throw new Error("ElevenLabsSTTProvider.initialize() not yet implemented");
  }

  async startListening(): Promise<void> {
    // TODO: Start sox subprocess to capture mic audio to temp file
    // TODO: Format: 16kHz, mono, 16-bit PCM WAV
    // TODO: Set this.isListening = true
    throw new Error("ElevenLabsSTTProvider.startListening() not yet implemented");
  }

  async stopListening(): Promise<TranscriptionResult> {
    // TODO: Stop sox capture
    // TODO: Read captured audio file
    // TODO: Send to ElevenLabs STT API:
    //   const formData = new FormData();
    //   formData.append('audio', audioBlob, 'recording.wav');
    //   formData.append('model_id', 'scribe_v1');
    //   const response = await fetch(this.apiUrl, {
    //     method: 'POST',
    //     headers: { 'xi-api-key': this.apiKey },
    //     body: formData,
    //   });
    // TODO: Parse response JSON for text, language_code, etc.
    // TODO: Clean up temp audio file
    // TODO: Return TranscriptionResult
    throw new Error("ElevenLabsSTTProvider.stopListening() not yet implemented");
  }

  async transcribe(audio: Buffer): Promise<TranscriptionResult> {
    // TODO: Wrap buffer in FormData and send to ElevenLabs STT API
    // TODO: Parse response and return TranscriptionResult
    throw new Error("ElevenLabsSTTProvider.transcribe() not yet implemented");
  }

  async dispose(): Promise<void> {
    // TODO: Clean up any running capture processes
    await super.dispose();
  }
}

/**
 * Abstract STT Provider Interface
 *
 * Defines the full contract that any speech-to-text provider must implement
 * to plug into the PAI Voice Input system. This abstraction allows swapping
 * between Whisper (local), ElevenLabs (cloud), macOS Dictation (system), or
 * any future provider without changing the pipeline.
 *
 * ## Provider Lifecycle
 *
 *   1. `initialize()` — Load models, authenticate with APIs, allocate resources.
 *   2. `startListening()` — Open the microphone stream and begin buffering audio.
 *   3. `stopListening()` — Close the mic, run transcription on captured audio, return result.
 *   4. `dispose()` — Free all resources (models, streams, temp files).
 *
 * ## Audio Format Requirements
 *
 * All providers receive audio in the format specified by `VoiceInputConfig.audio`:
 *   - Sample rate: 16000 Hz (standard for speech models)
 *   - Channels: 1 (mono)
 *   - Encoding: PCM signed 16-bit little-endian by default
 *
 * Providers that require different formats must handle conversion internally.
 *
 * ## Error Handling
 *
 * Providers should throw typed errors from the `STTError` union below.
 * The server layer catches these and returns appropriate HTTP responses.
 */

import type { STTProvider, TranscriptionResult, AudioSettings } from "../types";

// --- Error Types ---

export class STTInitializationError extends Error {
  constructor(provider: string, cause: string) {
    super(`[${provider}] Failed to initialize: ${cause}`);
    this.name = "STTInitializationError";
  }
}

export class STTTranscriptionError extends Error {
  constructor(provider: string, cause: string) {
    super(`[${provider}] Transcription failed: ${cause}`);
    this.name = "STTTranscriptionError";
  }
}

export class STTAudioCaptureError extends Error {
  constructor(provider: string, cause: string) {
    super(`[${provider}] Audio capture failed: ${cause}`);
    this.name = "STTAudioCaptureError";
  }
}

export type STTError =
  | STTInitializationError
  | STTTranscriptionError
  | STTAudioCaptureError;

// --- Abstract Base ---

/**
 * Optional abstract base class that providers can extend for shared behavior.
 * Providers can also implement `STTProvider` directly if they prefer.
 */
export abstract class BaseSTTProvider implements STTProvider {
  abstract readonly name: string;

  protected isInitialized = false;
  protected isListening = false;

  abstract initialize(): Promise<void>;
  abstract startListening(): Promise<void>;
  abstract stopListening(): Promise<TranscriptionResult>;
  abstract transcribe(audio: Buffer): Promise<TranscriptionResult>;

  async dispose(): Promise<void> {
    this.isListening = false;
    this.isInitialized = false;
  }

  /** Validate that audio settings are acceptable for this provider. */
  protected validateAudioSettings(settings: AudioSettings): void {
    if (settings.sampleRate < 8000 || settings.sampleRate > 48000) {
      throw new STTInitializationError(
        this.name,
        `Unsupported sample rate: ${settings.sampleRate}. Expected 8000-48000 Hz.`
      );
    }
    if (settings.channels !== 1) {
      throw new STTInitializationError(
        this.name,
        `Only mono audio (channels=1) is supported. Got ${settings.channels}.`
      );
    }
  }
}

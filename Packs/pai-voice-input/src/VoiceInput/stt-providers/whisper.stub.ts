/**
 * Whisper Local STT Provider (Stub)
 *
 * Uses OpenAI's Whisper model running locally via whisper.cpp for
 * fully offline, privacy-preserving speech-to-text.
 *
 * ## Implementation Approach
 *
 * 1. Use `whisper.cpp` (C++ port) via its Node bindings or CLI wrapper.
 *    - Binary: `brew install whisper-cpp` or build from source.
 *    - Model: `ggml-base.en.bin` (~142 MB) for English-only, fast inference.
 *    - Larger models (`ggml-medium.en.bin`) for higher accuracy at cost of speed.
 *
 * 2. Audio capture via `sox` or `node-audiorecorder` to get PCM from the mic.
 *    - Capture to temp WAV file, then pass to whisper.cpp CLI.
 *    - Or stream PCM directly to whisper.cpp bindings.
 *
 * 3. Transcription returns text with word-level timestamps and confidence.
 *
 * ## Trade-offs
 *
 * - Pros: Fully offline, no API costs, fast with GPU, excellent accuracy.
 * - Cons: Requires ~150 MB+ model download, CPU-heavy on base model,
 *   no real-time streaming (batch only without custom work).
 *
 * ## Dependencies
 *
 * - `whisper.cpp` binary (brew or manual build)
 * - A GGML model file (download from Hugging Face)
 * - `sox` for audio capture (`brew install sox`)
 */

import { BaseSTTProvider } from "./provider.interface";
import type { TranscriptionResult } from "../types";

export class WhisperProvider extends BaseSTTProvider {
  readonly name = "whisper-local";

  // TODO: Path to whisper.cpp binary
  private whisperBinaryPath = "/usr/local/bin/whisper-cpp";
  // TODO: Path to GGML model file
  private modelPath = "~/.local/share/whisper/ggml-base.en.bin";

  async initialize(): Promise<void> {
    // TODO: Verify whisper.cpp binary exists at whisperBinaryPath
    // TODO: Verify model file exists at modelPath
    // TODO: Verify sox is available for audio capture
    // TODO: Set this.isInitialized = true
    throw new Error("WhisperProvider.initialize() not yet implemented");
  }

  async startListening(): Promise<void> {
    // TODO: Start `sox` subprocess to capture mic audio to temp WAV file
    // TODO: Use format: 16kHz, mono, 16-bit PCM
    // TODO: Set this.isListening = true
    throw new Error("WhisperProvider.startListening() not yet implemented");
  }

  async stopListening(): Promise<TranscriptionResult> {
    // TODO: Stop sox capture subprocess
    // TODO: Run whisper.cpp on the captured WAV file
    // TODO: Parse whisper output (text, timestamps, confidence)
    // TODO: Clean up temp audio file
    // TODO: Set this.isListening = false
    // TODO: Return TranscriptionResult
    throw new Error("WhisperProvider.stopListening() not yet implemented");
  }

  async transcribe(audio: Buffer): Promise<TranscriptionResult> {
    // TODO: Write audio buffer to temp WAV file with proper headers
    // TODO: Run whisper.cpp on the temp file
    // TODO: Parse output and return TranscriptionResult
    // TODO: Clean up temp file
    throw new Error("WhisperProvider.transcribe() not yet implemented");
  }

  async dispose(): Promise<void> {
    // TODO: Kill any running sox or whisper processes
    // TODO: Clean up temp files
    await super.dispose();
  }
}

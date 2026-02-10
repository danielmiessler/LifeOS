/**
 * macOS Dictation STT Provider (Stub)
 *
 * Uses macOS built-in speech recognition via the NSSpeechRecognizer API
 * or the newer SFSpeechRecognizer framework. Zero-cost, zero-dependency
 * fallback when no API keys are configured.
 *
 * ## Implementation Approach
 *
 * ### Option A: AppleScript + System Dictation
 * - Trigger macOS Dictation programmatically (Fn Fn shortcut).
 * - Capture the dictated text from the active text field.
 * - Simple but fragile — depends on UI state and system settings.
 *
 * ### Option B: Swift Helper Binary
 * - Build a small Swift CLI tool using SFSpeechRecognizer.
 * - PAI calls the Swift binary, which captures audio and returns text.
 * - More robust, works headless, supports on-device and server models.
 * - Requires macOS 10.15+ and user permission for speech recognition.
 *
 * ### Option C: `say -i` Reverse (Experimental)
 * - macOS has no built-in CLI for STT (only TTS via `say`).
 * - Must use Swift/ObjC bridge for actual recognition.
 *
 * ## Trade-offs
 *
 * - Pros: Free, no API key, no network required, Apple Silicon optimized,
 *   system-level privacy (audio processed on-device).
 * - Cons: macOS only, requires Accessibility/Speech permissions,
 *   lower accuracy than Whisper or ElevenLabs for technical speech,
 *   limited language support compared to cloud providers.
 *
 * ## Dependencies
 *
 * - macOS 10.15+ (Catalina or later)
 * - Speech Recognition permission (System Settings > Privacy & Security)
 * - Microphone permission
 * - Swift toolchain (for building the helper binary)
 */

import { BaseSTTProvider } from "./provider.interface";
import type { TranscriptionResult } from "../types";

export class MacOSDictationProvider extends BaseSTTProvider {
  readonly name = "macos-dictation";

  // TODO: Path to compiled Swift STT helper binary
  private helperBinaryPath = "/usr/local/bin/pai-stt-helper";

  async initialize(): Promise<void> {
    // TODO: Check macOS version >= 10.15
    // TODO: Check if Swift helper binary exists, or offer to compile it
    // TODO: Verify Speech Recognition permission is granted
    // TODO: Verify Microphone permission is granted
    // TODO: Set this.isInitialized = true
    throw new Error("MacOSDictationProvider.initialize() not yet implemented");
  }

  async startListening(): Promise<void> {
    // TODO: Launch Swift helper in listening mode
    //   spawn(this.helperBinaryPath, ['--listen', '--format', 'json'])
    // TODO: The helper opens the mic and begins recognition
    // TODO: Set this.isListening = true
    throw new Error("MacOSDictationProvider.startListening() not yet implemented");
  }

  async stopListening(): Promise<TranscriptionResult> {
    // TODO: Send SIGINT to Swift helper to stop listening
    // TODO: Read JSON output from helper's stdout
    // TODO: Parse into TranscriptionResult
    // TODO: Set this.isListening = false
    throw new Error("MacOSDictationProvider.stopListening() not yet implemented");
  }

  async transcribe(audio: Buffer): Promise<TranscriptionResult> {
    // TODO: Write audio to temp file
    // TODO: Run Swift helper in file mode:
    //   spawn(this.helperBinaryPath, ['--file', tempFilePath, '--format', 'json'])
    // TODO: Parse JSON output into TranscriptionResult
    // TODO: Clean up temp file
    throw new Error("MacOSDictationProvider.transcribe() not yet implemented");
  }

  async dispose(): Promise<void> {
    // TODO: Kill Swift helper process if running
    await super.dispose();
  }
}

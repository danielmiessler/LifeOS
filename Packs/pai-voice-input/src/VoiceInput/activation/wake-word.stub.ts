/**
 * Wake Word Detector (Stub)
 *
 * Continuously listens on the default microphone for a trigger phrase
 * (e.g. "Hey JAM") and fires a callback when detected. This enables
 * hands-free activation of the voice input pipeline.
 *
 * ## Implementation Approaches
 *
 * ### Option A: Picovoice Porcupine
 * - Purpose-built wake word engine with custom keyword support.
 * - Runs entirely on-device, low CPU footprint.
 * - npm: `@picovoice/porcupine-node` + `@picovoice/pvrecorder-node`
 * - Requires free Picovoice access key for custom wake words.
 * - Train custom "Hey JAM" model at console.picovoice.ai
 * - Best balance of accuracy, CPU usage, and ease of integration.
 *
 * ### Option B: Whisper-based VAD + Keyword Spotting
 * - Use Voice Activity Detection (VAD) to detect speech onset.
 * - Run a fast Whisper pass on short audio chunks (~2 seconds).
 * - Check if transcription starts with the wake phrase.
 * - Pros: No extra dependencies beyond Whisper. Cons: Higher CPU, latency.
 *
 * ### Option C: Custom Keyword Spotter
 * - Train a small neural net (e.g. TensorFlow Lite) on recordings of
 *   the wake phrase. Very low CPU but requires training data.
 *
 * ## Architecture
 *
 * ```
 * Microphone (always-on, low-power)
 *     │
 *     ▼
 * Audio Stream (16kHz mono PCM)
 *     │
 *     ▼
 * Wake Word Engine (Porcupine / Whisper VAD / Custom)
 *     │
 *     ├─ No match → continue listening
 *     │
 *     └─ Match detected → fire onDetected callback
 *                              │
 *                              ▼
 *                    VoiceInput pipeline starts capture
 * ```
 */

import type { WakeWordDetector, WakeWordCallback } from "../types";

export class PorcupineWakeWordDetector implements WakeWordDetector {
  readonly phrase: string;
  private callbacks: WakeWordCallback[] = [];
  private isRunning = false;

  constructor(phrase: string = "Hey JAM") {
    this.phrase = phrase;
  }

  async start(): Promise<void> {
    // TODO: Initialize Porcupine with custom keyword model
    //   const porcupine = await Porcupine.create(
    //     accessKey,
    //     [keywordPath],  // Custom "Hey JAM" .ppn file
    //     [0.5]           // Sensitivity (0.0 - 1.0)
    //   );
    //
    // TODO: Start PvRecorder for continuous mic capture
    //   const recorder = await PvRecorder.create(porcupine.frameLength);
    //   recorder.start();
    //
    // TODO: Process frames in a loop:
    //   while (this.isRunning) {
    //     const frame = await recorder.read();
    //     const keywordIndex = porcupine.process(frame);
    //     if (keywordIndex >= 0) {
    //       this.callbacks.forEach(cb => cb());
    //     }
    //   }
    //
    // TODO: Set this.isRunning = true
    throw new Error("WakeWordDetector.start() not yet implemented");
  }

  async stop(): Promise<void> {
    // TODO: Set this.isRunning = false to break the processing loop
    // TODO: Stop and release PvRecorder
    // TODO: Release Porcupine instance
    throw new Error("WakeWordDetector.stop() not yet implemented");
  }

  onDetected(callback: WakeWordCallback): void {
    this.callbacks.push(callback);
  }
}

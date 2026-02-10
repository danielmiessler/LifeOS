/**
 * Global Hotkey Trigger (Stub)
 *
 * Registers a system-wide keyboard shortcut that activates voice input
 * regardless of which application is focused. This provides instant,
 * deliberate activation alongside the always-on wake word approach.
 *
 * ## Implementation Approaches
 *
 * ### Option A: node-global-key-listener (Recommended for MVP)
 * - npm: `node-global-key-listener`
 * - Cross-platform (macOS, Windows, Linux).
 * - Listens for key events at the OS level.
 * - Requires Accessibility permission on macOS.
 * - Simple API: register a callback for specific key combinations.
 *
 * ### Option B: macOS Accessibility API (Native Swift)
 * - Use CGEvent tap to intercept key events globally.
 * - Build a small Swift helper that communicates via IPC.
 * - Most reliable on macOS but requires Swift compilation.
 * - Pairs well with the macOS Dictation STT provider's Swift helper.
 *
 * ### Option C: Hammerspoon Integration
 * - If the user already has Hammerspoon installed, register a hotkey
 *   binding that sends an HTTP POST to the voice input server.
 * - Zero additional dependencies for Hammerspoon users.
 * - Example: `hs.hotkey.bind({"fn"}, "v", function() ... end)`
 *
 * ## Activation Flow
 *
 * ```
 * User presses hotkey (e.g. Fn+V)
 *     │
 *     ▼
 * Global Key Listener detects combo
 *     │
 *     ▼
 * Fire onTriggered callback
 *     │
 *     ▼
 * VoiceInput pipeline starts capture
 *     │
 *     ▼
 * User presses hotkey again (or silence timeout)
 *     │
 *     ▼
 * VoiceInput pipeline stops → transcribe → submit to Claude
 * ```
 *
 * ## Push-to-Talk vs Toggle
 *
 * Two modes are possible:
 * - **Push-to-talk**: Hold hotkey to record, release to transcribe.
 * - **Toggle**: Press once to start, press again to stop.
 *
 * Default: Toggle mode (simpler, less finger strain for longer dictation).
 */

import type { HotkeyTrigger, HotkeyCallback } from "../types";

export class GlobalHotkeyTrigger implements HotkeyTrigger {
  readonly combo: string;
  private callbacks: HotkeyCallback[] = [];
  private isRegistered = false;

  constructor(combo: string = "Fn+V") {
    this.combo = combo;
  }

  async register(): Promise<void> {
    // TODO: Initialize node-global-key-listener
    //   import { GlobalKeyboardListener } from 'node-global-key-listener';
    //   const listener = new GlobalKeyboardListener();
    //
    // TODO: Parse this.combo into modifier + key
    //   const [modifier, key] = this.combo.split('+');
    //
    // TODO: Register listener for the key combination
    //   listener.addListener((event, down) => {
    //     if (event.name === key && down[modifier.toUpperCase()]) {
    //       this.callbacks.forEach(cb => cb());
    //     }
    //   });
    //
    // TODO: On macOS, prompt for Accessibility permission if not granted
    // TODO: Set this.isRegistered = true
    throw new Error("GlobalHotkeyTrigger.register() not yet implemented");
  }

  async unregister(): Promise<void> {
    // TODO: Remove the key listener
    // TODO: Clean up node-global-key-listener instance
    // TODO: Set this.isRegistered = false
    throw new Error("GlobalHotkeyTrigger.unregister() not yet implemented");
  }

  onTriggered(callback: HotkeyCallback): void {
    this.callbacks.push(callback);
  }
}

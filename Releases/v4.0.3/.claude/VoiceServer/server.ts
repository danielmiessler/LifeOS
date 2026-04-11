#!/usr/bin/env bun
/**
 * Voice Server - Personal AI Voice notification server using Local Piper TTS and ElevenLabs fallback
 *
 * Architecture: Pure pass-through. All voice config comes from settings.json.
 * The server has zero hardcoded voice parameters.
 */

import { serve } from "bun";
import { spawn } from "child_process";
import { homedir } from "os";
import { join } from "path";
import { existsSync, readFileSync } from "fs";

// Load .env from user home directory
const envPath = join(homedir(), '.env');
if (existsSync(envPath)) {
  const envContent = await Bun.file(envPath).text();
  envContent.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value && !key.startsWith('#')) {
      process.env[key.trim()] = value.trim();
    }
  });
}

const PORT = parseInt(process.env.PORT || "8888");
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const PIPER_PATH = process.env.PIPER_PATH || join(homedir(), '.local/opt/piper/piper');
const PIPER_MODELS_DIR = process.env.PIPER_MODELS_DIR || join(homedir(), '.local/opt/piper/models');

// ==========================================================================
// Pronunciation System
// ==========================================================================

interface PronunciationEntry {
  term: string;
  phonetic: string;
  note?: string;
}

interface PronunciationConfig {
  replacements: PronunciationEntry[];
}

interface CompiledRule {
  regex: RegExp;
  phonetic: string;
}

let pronunciationRules: CompiledRule[] = [];

function loadPronunciations(): void {
  const pronPath = join(import.meta.dir, 'pronunciations.json');
  try {
    if (!existsSync(pronPath)) {
      console.warn('⚠️  No pronunciations.json found — TTS will use default pronunciations');
      return;
    }
    const content = readFileSync(pronPath, 'utf-8');
    const config: PronunciationConfig = JSON.parse(content);

    pronunciationRules = config.replacements.map(entry => ({
      regex: new RegExp(`\\b${escapeRegex(entry.term)}\\b`, 'g'),
      phonetic: entry.phonetic,
    }));

    console.log(`📖 Loaded ${pronunciationRules.length} pronunciation rules`);
  } catch (error) {
    console.error('⚠️  Failed to load pronunciations.json:', error);
  }
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function applyPronunciations(text: string): string {
  let result = text;
  for (const rule of pronunciationRules) {
    result = result.replace(rule.regex, rule.phonetic);
  }
  return result;
}

loadPronunciations();

// ==========================================================================
// Voice Configuration
// ==========================================================================

interface ElevenLabsVoiceSettings {
  stability: number;
  similarity_boost: number;
  style?: number;
  speed?: number;
  use_speaker_boost?: boolean;
}

interface VoiceEntry {
  voiceId: string;
  voiceName?: string;
  provider?: 'elevenlabs' | 'piper';
  stability: number;
  similarity_boost: number;
  style: number;
  speed: number;
  use_speaker_boost: boolean;
  volume: number;
}

interface LoadedVoiceConfig {
  defaultVoiceId: string;
  voices: Record<string, VoiceEntry>;
  voicesByVoiceId: Record<string, VoiceEntry>;
  desktopNotifications: boolean;
}

const FALLBACK_VOICE_SETTINGS: ElevenLabsVoiceSettings = {
  stability: 0.5,
  similarity_boost: 0.75,
  style: 0.0,
  speed: 1.0,
  use_speaker_boost: true,
};
const FALLBACK_VOLUME = 1.0;

function loadVoiceConfig(): LoadedVoiceConfig {
  const settingsPath = join(homedir(), '.claude', 'settings.json');

  try {
    if (!existsSync(settingsPath)) {
      console.warn('⚠️  settings.json not found — using fallback voice defaults');
      return { defaultVoiceId: '', voices: {}, voicesByVoiceId: {}, desktopNotifications: true };
    }

    const content = readFileSync(settingsPath, 'utf-8');
    const settings = JSON.parse(content);
    const daidentity = settings.daidentity || {};
    const voicesSection = daidentity.voices || {};
    const desktopNotifications = settings.notifications?.desktop?.enabled !== false;

    const voices: Record<string, VoiceEntry> = {};
    const voicesByVoiceId: Record<string, VoiceEntry> = {};

    for (const [name, config] of Object.entries(voicesSection)) {
      const entry = config as any;
      if (entry.voiceId) {
        const voiceEntry: VoiceEntry = {
          voiceId: entry.voiceId,
          voiceName: entry.voiceName,
          provider: entry.provider || 'elevenlabs',
          stability: entry.stability ?? 0.5,
          similarity_boost: entry.similarity_boost ?? entry.similarityBoost ?? 0.75,
          style: entry.style ?? 0.0,
          speed: entry.speed ?? 1.0,
          use_speaker_boost: entry.use_speaker_boost ?? entry.useSpeakerBoost ?? true,
          volume: entry.volume ?? 1.0,
        };
        voices[name] = voiceEntry;
        voicesByVoiceId[entry.voiceId] = voiceEntry;
      }
    }

    const defaultVoiceId = voices.main?.voiceId || daidentity.mainDAVoiceID || '';

    return { defaultVoiceId, voices, voicesByVoiceId, desktopNotifications };
  } catch (error) {
    console.error('⚠️  Failed to load settings.json voice config:', error);
    return { defaultVoiceId: '', voices: {}, voicesByVoiceId: {}, desktopNotifications: true };
  }
}

let voiceConfig = loadVoiceConfig();
const DEFAULT_VOICE_ID = voiceConfig.defaultVoiceId || "s3TPKV1kjDlVtZbl4Ksh";

function lookupVoiceByVoiceId(voiceId: string): VoiceEntry | null {
  return voiceConfig.voicesByVoiceId[voiceId] || null;
}

// ==========================================================================
// Audio Generation
// ==========================================================================

async function generateSpeechPiper(text: string, voiceId: string, speed: number = 1.0): Promise<string> {
  const modelPath = join(PIPER_MODELS_DIR, `${voiceId}.onnx`);
  if (!existsSync(PIPER_PATH)) throw new Error(`Piper binary not found at ${PIPER_PATH}`);
  if (!existsSync(modelPath)) throw new Error(`Piper model not found at ${modelPath}`);

  const tempFile = `/tmp/voice-${Date.now()}.wav`;
  
  return new Promise((resolve, reject) => {
    const args = [
      '--model', modelPath,
      '--output_file', tempFile,
      '--length_scale', (1.0 / speed).toString()
    ];
    
    const piper = spawn(PIPER_PATH, args);
    piper.stdin.write(text);
    piper.stdin.end();

    piper.on('error', reject);
    piper.on('exit', (code) => {
      if (code === 0) resolve(tempFile);
      else reject(new Error(`Piper exited with code ${code}`));
    });
  });
}

async function generateSpeechElevenLabs(text: string, voiceId: string, settings: ElevenLabsVoiceSettings): Promise<ArrayBuffer> {
  if (!ELEVENLABS_API_KEY) throw new Error('ElevenLabs API key not configured');

  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Accept': 'audio/mpeg',
      'Content-Type': 'application/json',
      'xi-api-key': ELEVENLABS_API_KEY,
    },
    body: JSON.stringify({
      text,
      model_id: 'eleven_turbo_v2_5',
      voice_settings: settings,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
  }

  return await response.arrayBuffer();
}

// ==========================================================================
// Audio Playback
// ==========================================================================

async function playAudio(source: string | ArrayBuffer, volume: number = 1.0): Promise<void> {
  let filePath: string;
  let isTemp = false;

  if (typeof source === 'string') {
    filePath = source;
  } else {
    filePath = `/tmp/voice-${Date.now()}.mp3`;
    await Bun.write(filePath, source);
    isTemp = true;
  }

  return new Promise((resolve, reject) => {
    // Detect player: mpv (Linux preferred), afplay (macOS)
    const player = existsSync('/usr/bin/mpv') ? '/usr/bin/mpv' : '/usr/bin/afplay';
    const args = player.includes('mpv') 
      ? ['--no-terminal', `--volume=${volume * 100}`, filePath]
      : ['-v', volume.toString(), filePath];

    const proc = spawn(player, args);
    proc.on('error', reject);
    proc.on('exit', (code) => {
      if (isTemp || filePath.startsWith('/tmp/')) spawn('/bin/rm', [filePath]);
      if (code === 0) resolve();
      else reject(new Error(`${player} exited with code ${code}`));
    });
  });
}

// ==========================================================================
// Notification Logic
// ==========================================================================

function sanitizeForSpeech(input: string): string {
  return input
    .replace(/[;&|><`$\\]/g, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .trim()
    .substring(0, 500);
}

async function sendNotification(title: string, message: string, voiceEnabled = true, voiceId: string | null = null): Promise<void> {
  const safeMessage = applyPronunciations(sanitizeForSpeech(message));
  
  if (voiceEnabled) {
    // Reload config in case it changed
    voiceConfig = loadVoiceConfig();
    const voiceEntry = lookupVoiceByVoiceId(voiceId || DEFAULT_VOICE_ID) || voiceConfig.voices.main;
    
    try {
      if (voiceEntry?.provider === 'piper') {
        console.log(`🎙️  Generating Piper speech: ${voiceEntry.voiceId}`);
        const wavFile = await generateSpeechPiper(safeMessage, voiceEntry.voiceId, voiceEntry.speed);
        await playAudio(wavFile, voiceEntry.volume);
      } else {
        console.log(`🎙️  Generating ElevenLabs speech: ${voiceId || DEFAULT_VOICE_ID}`);
        const settings = voiceEntry ? {
          stability: voiceEntry.stability,
          similarity_boost: voiceEntry.similarity_boost,
          style: voiceEntry.style,
          speed: voiceEntry.speed,
          use_speaker_boost: voiceEntry.use_speaker_boost
        } : FALLBACK_VOICE_SETTINGS;
        
        const audioBuffer = await generateSpeechElevenLabs(safeMessage, voiceId || DEFAULT_VOICE_ID, settings);
        await playAudio(audioBuffer, voiceEntry?.volume || FALLBACK_VOLUME);
      }
    } catch (error) {
      console.error("TTS failed:", error);
    }
  }

  // Linux Notification (libnotify)
  if (voiceConfig.desktopNotifications && existsSync('/usr/bin/notify-send')) {
    spawn('/usr/bin/notify-send', [title, message]);
  }
}

// ==========================================================================
// Server Start
// ==========================================================================

serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === "/notify" && req.method === "POST") {
      const data = await req.json();
      await sendNotification(data.title || "PAI", data.message || "", data.voice_enabled !== false, data.voice_id);
      return new Response(JSON.stringify({ status: "success" }), { headers: { "Content-Type": "application/json" } });
    }
    if (url.pathname === "/health") {
      return new Response(JSON.stringify({ status: "healthy", piper: existsSync(PIPER_PATH) }), { headers: { "Content-Type": "application/json" } });
    }
    return new Response("Voice Server", { status: 200 });
  }
});

console.log(`🚀 Voice Server running on port ${PORT}`);

import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { __remoteVoiceTest, __voiceModeTest, handleVoiceRequest, localTtsRequest, startVoice, voiceSystem } from "./voice"

describe("localTtsRequest", () => {
  test("OpenAI-compatible URL gets the speech shape with WAV out", () => {
    expect(localTtsRequest("http://127.0.0.1:8880/v1/audio/speech", "hi", { LOCAL_TTS_VOICE: "af_heart", LOCAL_TTS_MODEL: "kokoro" }))
      .toEqual({ model: "kokoro", input: "hi", voice: "af_heart", response_format: "wav" })
    expect(localTtsRequest("http://h/v1/audio/speech/", "hi", {})).toEqual({ model: "tts-1", input: "hi", voice: "alloy", response_format: "wav" })
  })

  test("any other URL gets the Piper-style shape", () => {
    expect(localTtsRequest("http://127.0.0.1:8768/say", "hi", {})).toEqual({ text: "hi" })
    expect(localTtsRequest("http://127.0.0.1:8768/say", "hi", { LOCAL_TTS_VOICE: "en_US-amy-medium", LOCAL_TTS_SPEED: "1.2" }))
      .toEqual({ text: "hi", voice: "en_US-amy-medium", speed: 1.2 })
  })
})

describe("voiceSystem", () => {
  test("Fish wins, local only without a Fish key", () => {
    expect(voiceSystem({ fish_api_key: "k" }, { fishReferenceId: "r" }, "http://x/say")).toBe("Fish")
    expect(voiceSystem({ fish_api_key: "k" }, undefined, "http://x/say")).toBe("off")
    expect(voiceSystem({}, undefined, "http://x/say")).toBe("local")
    expect(voiceSystem({}, undefined, undefined)).toBe("off")
  })
})

describe("/notify through a local TTS server", () => {
  const bodies: Record<string, unknown>[] = []
  const played: string[] = []
  const tmp = mkdtempSync(join(tmpdir(), "local-tts-test-"))
  const saved = { url: process.env.LOCAL_TTS_URL, fish: process.env.FISH_API_KEY, ledger: process.env.LIFEOS_INTERRUPTIONS_LEDGER }
  let server: ReturnType<typeof Bun.serve>

  beforeAll(() => {
    server = Bun.serve({
      port: 0,
      async fetch(req) {
        bodies.push(await req.json())
        return new Response(new Uint8Array([82, 73, 70, 70, 0, 0]), { headers: { "Content-Type": "audio/wav" } })
      },
    })
    process.env.LOCAL_TTS_URL = `http://127.0.0.1:${server.port}/say`
    delete process.env.FISH_API_KEY
    process.env.LIFEOS_INTERRUPTIONS_LEDGER = join(tmp, "interruptions.jsonl")
    __remoteVoiceTest.setSinkProbe(async () => null)
    __voiceModeTest.setPlayer({ path: "/usr/bin/true", buildArgs: (file) => { played.push(file); return [] } })
    startVoice({ enabled: true })
  })

  afterAll(() => {
    server.stop()
    __remoteVoiceTest.setSinkProbe(null)
    __voiceModeTest.setPlayer(null)
    for (const [key, value] of [["LOCAL_TTS_URL", saved.url], ["FISH_API_KEY", saved.fish], ["LIFEOS_INTERRUPTIONS_LEDGER", saved.ledger]] as const) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
    rmSync(tmp, { recursive: true, force: true })
  })

  test("speaks the tag-stripped text and plays the WAV", async () => {
    __remoteVoiceTest.resetRateLimit()
    const res = await handleVoiceRequest(new Request("http://localhost/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "t", message: "Build is <emphasis>green</emphasis>" }),
    }))
    expect(res?.status).toBe(200)
    expect(bodies.at(-1)?.text).toBe("Build is green")
    expect(played.at(-1)).toEndWith(".wav")
  })
})

import { describe, expect, test } from "bun:test"
import { sshPeers, trustedPeer } from "./voice"
import { playerArgs } from "./receiver/VoiceReceiver"

describe("sshPeers", () => {
  test("parses macOS lsof output", () => {
    const out = "sshd 812 root 4u IPv4 0x1 0t0 TCP 100.70.1.2:22->100.80.3.4:51234 (ESTABLISHED)\n"
    expect(sshPeers(out)).toEqual(["100.80.3.4"])
  })

  test("parses Linux ss -tnH output, plain and v4-mapped", () => {
    const out = "0      0      192.168.1.10:22 192.168.1.20:40300\n0 0 [::ffff:192.168.1.10]:22 [::ffff:10.0.0.9]:5000\n"
    expect(sshPeers(out)).toEqual(["192.168.1.20", "10.0.0.9"])
  })
})

describe("trustedPeer", () => {
  test("tailnet range is trusted with no extra list", () => {
    expect(trustedPeer("100.64.0.1", "")).toBe(true)
    expect(trustedPeer("100.127.255.254", "")).toBe(true)
    expect(trustedPeer("100.128.0.1", "")).toBe(false)
  })

  test("a LAN address needs VOICE_RECEIVER_PEERS", () => {
    expect(trustedPeer("192.168.1.20", "")).toBe(false)
    expect(trustedPeer("192.168.1.20", "192.168.1.20")).toBe(true)
    expect(trustedPeer("192.168.1.21", "192.168.1.20/32")).toBe(false)
    expect(trustedPeer("10.8.0.5", " 192.168.1.20, 10.8.0.0/24")).toBe(true)
  })

  test("garbage entries never match", () => {
    expect(trustedPeer("192.168.1.20", "nope,192.168.1.0/99,/24")).toBe(false)
  })
})

describe("playerArgs", () => {
  const has = (...cmds: string[]) => (cmd: string) => (cmds.includes(cmd) ? `/usr/bin/${cmd}` : null)

  test("macOS uses afplay", () => {
    expect(playerArgs("a.mp3", 1, "darwin", has())).toEqual(["afplay", "-v", "1", "a.mp3"])
  })

  test("Linux prefers mpv, then ffplay, then paplay, and clamps volume", () => {
    expect(playerArgs("a.mp3", 2, "linux", has("mpv", "paplay"))).toEqual(["mpv", "--no-video", "--really-quiet", "--volume=100", "a.mp3"])
    expect(playerArgs("a.mp3", 0.5, "linux", has("ffplay"))?.slice(0, 1)).toEqual(["ffplay"])
    expect(playerArgs("a.mp3", 0.5, "linux", has("paplay"))).toEqual(["paplay", "--volume=32768", "a.mp3"])
    expect(playerArgs("a.mp3", 1, "linux", has())).toBeNull()
  })
})

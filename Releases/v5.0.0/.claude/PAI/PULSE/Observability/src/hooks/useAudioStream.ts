"use client"

import { useEffect, useRef, useState } from "react"

export function useAudioStream(enabled: boolean): { connected: boolean; initAudio: () => void } {
  const [connected, setConnected] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const backoffRef = useRef(1000)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const enabledRef = useRef(enabled)
  const unlockRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    enabledRef.current = enabled
  }, [enabled])

  useEffect(() => {
    if (!enabled) {
      wsRef.current?.close()
      wsRef.current = null
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
      if (unlockRef.current) {
        document.removeEventListener("click", unlockRef.current)
        document.removeEventListener("keydown", unlockRef.current)
        unlockRef.current = null
      }
      setConnected(false)
      return
    }

    // Create AudioContext eagerly so it's ready when audio arrives
    if (!audioCtxRef.current || audioCtxRef.current.state === "closed") {
      audioCtxRef.current = new AudioContext()
    }

    // If suspended (page loaded without a prior gesture), unlock on first user interaction
    if (audioCtxRef.current.state === "suspended" && !unlockRef.current) {
      const unlock = () => {
        audioCtxRef.current?.resume()
        document.removeEventListener("click", unlock)
        document.removeEventListener("keydown", unlock)
        unlockRef.current = null
      }
      unlockRef.current = unlock
      document.addEventListener("click", unlock)
      document.addEventListener("keydown", unlock)
    }

    function connect() {
      if (!enabledRef.current) return
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:"
      const ws = new WebSocket(`${protocol}//${window.location.host}/ws/audio`)
      ws.binaryType = "arraybuffer"
      wsRef.current = ws

      ws.onopen = () => {
        setConnected(true)
        backoffRef.current = 1000
      }

      ws.onmessage = async (event: MessageEvent<ArrayBuffer>) => {
        try {
          if (!audioCtxRef.current) audioCtxRef.current = new AudioContext()
          const ctx = audioCtxRef.current
          if (ctx.state === "suspended") await ctx.resume()
          // .slice(0) creates a copy so the buffer isn't transferred before decoding
          const decoded = await ctx.decodeAudioData(event.data.slice(0))
          const source = ctx.createBufferSource()
          source.buffer = decoded
          source.connect(ctx.destination)
          source.start()
        } catch (e) {
          console.warn("[PAI audio] decode/play error", e)
        }
      }

      ws.onclose = () => {
        setConnected(false)
        if (!enabledRef.current) return
        reconnectTimerRef.current = setTimeout(() => {
          backoffRef.current = Math.min(backoffRef.current * 2, 30_000)
          connect()
        }, backoffRef.current)
      }

      ws.onerror = () => ws.close()
    }

    connect()
    return () => {
      wsRef.current?.close()
      wsRef.current = null
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
    }
  }, [enabled])

  function initAudio() {
    // Replace any stuck-suspended context with a fresh one during the user gesture
    if (audioCtxRef.current?.state === "suspended") {
      audioCtxRef.current.close()
      audioCtxRef.current = null
    }
    if (unlockRef.current) {
      document.removeEventListener("click", unlockRef.current)
      document.removeEventListener("keydown", unlockRef.current)
      unlockRef.current = null
    }
    if (!audioCtxRef.current) audioCtxRef.current = new AudioContext()
    audioCtxRef.current.resume()
  }

  return { connected, initAudio }
}

"use client"

import { useEffect, useRef, useState } from "react"

export function useAudioStream(enabled: boolean): { connected: boolean } {
  const [connected, setConnected] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const backoffRef = useRef(1000)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const enabledRef = useRef(enabled)

  useEffect(() => {
    enabledRef.current = enabled
  }, [enabled])

  useEffect(() => {
    if (!enabled) {
      wsRef.current?.close()
      wsRef.current = null
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
      setConnected(false)
      return
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

  return { connected }
}

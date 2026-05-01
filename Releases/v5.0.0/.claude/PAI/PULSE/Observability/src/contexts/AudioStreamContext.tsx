"use client"

import { createContext, useContext, useState, useEffect } from "react"
import { useAudioStream } from "@/hooks/useAudioStream"

const LS_KEY = "pai-audio-enabled"

interface AudioStreamContextValue {
  enabled: boolean
  connected: boolean
  toggle: () => void
}

const AudioStreamContext = createContext<AudioStreamContextValue>({
  enabled: false,
  connected: false,
  toggle: () => {},
})

export function AudioStreamProvider({ children }: { children: React.ReactNode }) {
  const [enabled, setEnabled] = useState(false)

  // Read saved preference once on mount
  useEffect(() => {
    setEnabled(localStorage.getItem(LS_KEY) === "true")
  }, [])

  const { connected, initAudio } = useAudioStream(enabled)

  const toggle = () => {
    const next = !enabled
    localStorage.setItem(LS_KEY, String(next))
    if (next) initAudio() // unlock AudioContext during the user gesture, before state update
    setEnabled(next)
  }

  return (
    <AudioStreamContext.Provider value={{ enabled, connected, toggle }}>
      {children}
    </AudioStreamContext.Provider>
  )
}

export function useAudioStreamContext() {
  return useContext(AudioStreamContext)
}

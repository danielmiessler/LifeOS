#!/usr/bin/env bun
/**
 * Calendar Check — Script-type job
 *
 * Zero AI cost: Google Calendar API → format → voice notification.
 * Checks for events in the next 30 minutes.
 *
 * Output: spoken notification or NO_EVENTS
 */

import { readFileSync } from "fs"
import { join } from "path"
import { getClaudeDir } from "../../TOOLS/Paths";

const HOME = process.env.HOME ?? ""
const LOOKAHEAD_MS = 30 * 60 * 1000

function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {}
  try {
    const content = readFileSync(join(getClaudeDir(), ".env"), "utf-8")
    for (const line of content.split("\n")) {
      const match = line.match(/^([^#=]+)=(.*)$/)
      if (match) {
        let val = match[2].trim()
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
          val = val.slice(1, -1)
        env[match[1].trim()] = val
      }
    }
  } catch {}
  return env
}

async function getAccessToken(env: Record<string, string>): Promise<string> {
  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.GMAIL_CLIENT_ID,
      client_secret: env.GMAIL_CLIENT_SECRET,
      refresh_token: env.GOOGLE_CALENDAR_REFRESH_TOKEN,
      grant_type: "refresh_token",
    }),
  })
  const data = (await resp.json()) as { access_token?: string }
  if (!data.access_token) throw new Error("Token refresh failed")
  return data.access_token
}

async function main() {
  const env = loadEnv()

  if (!env.GOOGLE_CALENDAR_REFRESH_TOKEN) {
    console.error("GOOGLE_CALENDAR_REFRESH_TOKEN not set")
    console.log("NO_EVENTS")
    return
  }

  try {
    const token = await getAccessToken(env)
    const now = new Date().toISOString()
    const later = new Date(Date.now() + LOOKAHEAD_MS).toISOString()

    const calListResp = await fetch("https://www.googleapis.com/calendar/v3/users/me/calendarList", {
      headers: { Authorization: `Bearer ${token}` },
    })
    const calList = (await calListResp.json()) as { items?: Array<{ id: string }> }
    const calIds = (calList.items || []).map((c) => c.id)
    if (calIds.length === 0) calIds.push("primary")

    const allEvents: Array<{ id: string; start: { dateTime?: string }; summary?: string }> = []
    await Promise.all(
      calIds.map(async (calId) => {
        try {
          const resp = await fetch(
            `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events?` +
              `timeMin=${now}&timeMax=${later}&singleEvents=true&orderBy=startTime&maxResults=10`,
            { headers: { Authorization: `Bearer ${token}` } }
          )
          const data = (await resp.json()) as { items?: typeof allEvents }
          if (data.items) allEvents.push(...data.items)
        } catch {}
      })
    )

    // Filter timed events, deduplicate
    const seen = new Set<string>()
    const meetings = allEvents
      .filter((ev) => {
        if (!ev.start?.dateTime) return false
        if (seen.has(ev.id)) return false
        seen.add(ev.id)
        return true
      })
      .sort((a, b) => new Date(a.start.dateTime!).getTime() - new Date(b.start.dateTime!).getTime())

    if (meetings.length === 0) {
      console.log("NO_EVENTS")
      return
    }

    const parts: string[] = []
    for (const ev of meetings.slice(0, 3)) {
      const mins = Math.round((new Date(ev.start.dateTime!).getTime() - Date.now()) / 60000)
      const title = ev.summary || "Untitled event"
      if (mins <= 1) parts.push(`${title} is starting now`)
      else if (mins <= 5) parts.push(`${title} starts in ${mins} minutes`)
      else parts.push(`${title} in ${mins} minutes`)
    }

    console.log(parts.join(". ") + ".")
  } catch (e: unknown) {
    console.error("Calendar check failed:", e instanceof Error ? e.message : String(e))
    console.log("NO_EVENTS")
  }
}

main()

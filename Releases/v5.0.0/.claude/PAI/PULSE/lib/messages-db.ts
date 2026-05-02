/**
 * macOS Messages.db Reader
 *
 * Polls ~/Library/Messages/chat.db for new incoming messages.
 * Requires Full Disk Access granted to the terminal app.
 *
 * Uses bun:sqlite for zero-dependency SQLite access.
 *
 * Absorbed from iMessageBot/lib/messages-db.ts into Pulse module system.
 */

import { Database } from "bun:sqlite"
import { join } from "path"
import { homedir } from "os"

const CHAT_DB_PATH = join(homedir(), "Library", "Messages", "chat.db")

// Apple epoch: 2001-01-01 00:00:00 UTC
// chat.db stores dates as nanoseconds since Apple epoch
const APPLE_EPOCH_OFFSET = 978307200 // seconds between Unix epoch and Apple epoch

export interface IncomingMessage {
  rowid: number
  text: string
  date: Date
  handle: string // phone number or email
  service: string // "iMessage" or "SMS"
  chatId: string // chat identifier for reply routing
}

/**
 * Get new incoming messages since a given ROWID.
 * Only returns messages NOT from the user (is_from_me = 0).
 */
export function getNewMessages(sinceRowId: number): IncomingMessage[] {
  const db = new Database(CHAT_DB_PATH, { readonly: true })

  try {
    const rows = db
      .query(`
        SELECT
          m.ROWID as rowid,
          m.text,
          m.date,
          m.is_from_me,
          COALESCE(h.id, '') as handle,
          COALESCE(h.service, '') as service,
          COALESCE(c.chat_identifier, '') as chat_id
        FROM message m
        LEFT JOIN handle h ON m.handle_id = h.ROWID
        LEFT JOIN chat_message_join cmj ON cmj.message_id = m.ROWID
        LEFT JOIN chat c ON cmj.chat_id = c.ROWID
        WHERE m.ROWID > ?
          AND m.is_from_me = 0
          AND m.text IS NOT NULL
          AND m.text != ''
        ORDER BY m.ROWID ASC
      `)
      .all(sinceRowId) as Array<{
        rowid: number
        text: string
        date: number
        is_from_me: number
        handle: string
        service: string
        chat_id: string
      }>

    return rows.map((row) => ({
      rowid: row.rowid,
      text: row.text,
      handle: row.handle,
      service: row.service,
      chatId: row.chat_id,
      // Convert Apple nanosecond timestamp to JS Date
      date: new Date((row.date / 1e9 + APPLE_EPOCH_OFFSET) * 1000),
    }))
  } finally {
    db.close()
  }
}

/**
 * Get the highest message ROWID in the database.
 * Used to initialize the cursor on first run (skip all existing messages).
 */
export function getLatestRowId(): number {
  const db = new Database(CHAT_DB_PATH, { readonly: true })
  try {
    const row = db.query("SELECT MAX(ROWID) as max_id FROM message").get() as {
      max_id: number | null
    }
    return row?.max_id ?? 0
  } finally {
    db.close()
  }
}

/**
 * Verify database access. Throws if Full Disk Access is not granted.
 */
export function verifyAccess(): void {
  const db = new Database(CHAT_DB_PATH, { readonly: true })
  try {
    db.query("SELECT count(*) FROM message").get()
  } finally {
    db.close()
  }
}

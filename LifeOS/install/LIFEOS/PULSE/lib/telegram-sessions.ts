/**
 * Telegram Session Persistence — SQLite-backed SDK session tracking
 *
 * Mirrors Hermes pattern: SQLite for session state, SDK resume for continuity,
 * compaction when turns exceed threshold.
 *
 * Schema:
 *   chat_id        TEXT PRIMARY KEY  — Telegram chat ID (string for consistency)
 *   session_id     TEXT NOT NULL     — SDK session ID for resume
 *   created_at     TEXT NOT NULL     — ISO timestamp
 *   last_message_at TEXT NOT NULL    — ISO timestamp of last successful exchange
 *   message_count  INTEGER NOT NULL  — Total messages in this session
 *   compacted_at   TEXT              — ISO timestamp of last compaction (null if never)
 *   compaction_count INTEGER NOT NULL — How many times this chat has compacted
 */

import { Database } from "bun:sqlite"
import { join } from "path"
import { mkdirSync } from "fs"
import { claudeDir } from "../../TOOLS/lifeos-root";

const HOME = process.env.HOME ?? ""
const DB_DIR = join(claudeDir(), "LIFEOS", "PULSE", "state", "telegram")
const DB_PATH = join(DB_DIR, "sessions.db")

// Compaction threshold — after this many turns, we'll compact the session
export const COMPACTION_THRESHOLD = 50

export interface SessionRow {
  chat_id: string
  session_id: string
  created_at: string
  last_message_at: string
  message_count: number
  compacted_at: string | null
  compaction_count: number
}

let db: Database | null = null

function getDb(): Database {
  if (db) return db

  // Ensure directory exists
  mkdirSync(DB_DIR, { recursive: true })

  db = new Database(DB_PATH, { create: true })

  // Create table if not exists
  db.run(`
    CREATE TABLE IF NOT EXISTS telegram_sessions (
      chat_id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      last_message_at TEXT NOT NULL,
      message_count INTEGER NOT NULL DEFAULT 0,
      compacted_at TEXT,
      compaction_count INTEGER NOT NULL DEFAULT 0
    )
  `)

  return db
}

/**
 * Get the current session for a chat, if one exists and is still valid.
 */
export function getSession(chatId: string | number): SessionRow | null {
  const row = getDb()
    .query<SessionRow, [string]>(
      "SELECT * FROM telegram_sessions WHERE chat_id = ?",
    )
    .get(String(chatId))
  return row ?? null
}

/**
 * Create or update a session after a successful SDK exchange.
 */
export function upsertSession(
  chatId: string | number,
  sessionId: string,
): SessionRow {
  const now = new Date().toISOString()
  const chatIdStr = String(chatId)

  const existing = getSession(chatIdStr)

  if (existing) {
    // Update existing session
    getDb().run(
      `UPDATE telegram_sessions
       SET session_id = ?, last_message_at = ?, message_count = message_count + 1
       WHERE chat_id = ?`,
      [sessionId, now, chatIdStr],
    )
  } else {
    // Create new session
    getDb().run(
      `INSERT INTO telegram_sessions (chat_id, session_id, created_at, last_message_at, message_count, compaction_count)
       VALUES (?, ?, ?, ?, 1, 0)`,
      [chatIdStr, sessionId, now, now],
    )
  }

  return getSession(chatIdStr)!
}

/**
 * Mark a session as compacted — reset message count, update compacted_at, bump compaction_count.
 * Called after we start a fresh SDK session due to hitting the compaction threshold.
 */
export function markCompacted(
  chatId: string | number,
  newSessionId: string,
): SessionRow {
  const now = new Date().toISOString()
  const chatIdStr = String(chatId)

  getDb().run(
    `UPDATE telegram_sessions
     SET session_id = ?, last_message_at = ?, message_count = 1, compacted_at = ?, compaction_count = compaction_count + 1
     WHERE chat_id = ?`,
    [newSessionId, now, now, chatIdStr],
  )

  return getSession(chatIdStr)!
}

/**
 * Clear a session (e.g., on idle timeout or explicit reset).
 */
export function clearSession(chatId: string | number): void {
  getDb().run("DELETE FROM telegram_sessions WHERE chat_id = ?", [
    String(chatId),
  ])
}

/**
 * Check if a session needs compaction based on message count.
 */
export function needsCompaction(session: SessionRow): boolean {
  return session.message_count >= COMPACTION_THRESHOLD
}

/**
 * Check if a session is stale (idle timeout exceeded).
 */
export function isStale(session: SessionRow, idleTimeoutMs: number): boolean {
  const lastMessageMs = new Date(session.last_message_at).getTime()
  return Date.now() - lastMessageMs > idleTimeoutMs
}

/**
 * Get all sessions (for debugging/status).
 */
export function getAllSessions(): SessionRow[] {
  return getDb()
    .query<SessionRow, []>("SELECT * FROM telegram_sessions ORDER BY last_message_at DESC")
    .all()
}

/**
 * Close the database connection (for clean shutdown).
 */
export function closeDb(): void {
  if (db) {
    db.close()
    db = null
  }
}

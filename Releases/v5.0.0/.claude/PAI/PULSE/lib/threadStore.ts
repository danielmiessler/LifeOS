/**
 * Thread-aware conversation persistence for Telegram-style chat bots.
 *
 * Each thread is rooted at a user's top-level message. Replies to bot messages
 * resume the thread that produced the replied-to message. Top-level messages
 * always start a new thread, even from the same chat — context never bleeds
 * across topics.
 *
 * On-disk shape (single file, atomic write via tmp+rename):
 *   {
 *     "threads": { "<threadId>": { sessionId, history[], topic, lastBotMessageId, updated } },
 *     "botMessageToThread": { "<botMessageId>": <threadId> }
 *   }
 *
 * threadId = the Telegram message_id of the user's root message (stable per chat).
 */

import { join } from "path"

export interface ThreadMessage {
  role: "user" | "assistant"
  content: string
  timestamp: number
}

export interface Thread {
  sessionId?: string
  history: ThreadMessage[]
  topic: string
  lastBotMessageId?: number
  updated: number
  created: number
}

interface PersistShape {
  threads: Record<string, Thread>
  botMessageToThread: Record<string, number>
}

export class ThreadStore {
  private threads: Map<number, Thread> = new Map()
  private botMessageToThread: Map<number, number> = new Map()

  constructor(
    private readonly path: string,
    private readonly maxHistoryPerThread = 40,
    private readonly maxBotMessageEntries = 2000,
    private readonly threadStaleMs = 30 * 24 * 60 * 60 * 1000,
  ) {}

  async load(): Promise<void> {
    try {
      const file = Bun.file(this.path)
      if (!(await file.exists())) return
      const raw = (await file.json()) as PersistShape
      this.threads = new Map(
        Object.entries(raw.threads ?? {}).map(([k, v]) => [Number(k), v]),
      )
      this.botMessageToThread = new Map(
        Object.entries(raw.botMessageToThread ?? {}).map(([k, v]) => [Number(k), Number(v)]),
      )
      this.pruneStale()
    } catch {
      this.threads = new Map()
      this.botMessageToThread = new Map()
    }
  }

  /**
   * Resolve which thread a new incoming message belongs to.
   * - If user replied to a bot message we recognize → that thread.
   * - Otherwise → new thread rooted at this message_id.
   *
   * Returns the threadId and a flag indicating whether the thread was just created.
   */
  resolveThread(args: {
    incomingMessageId: number
    incomingText: string
    replyToBotMessageId?: number
    botId?: number
    replyToFromIsBot?: boolean
    replyToFromId?: number
  }): { threadId: number; created: boolean } {
    const { incomingMessageId, incomingText, replyToBotMessageId, replyToFromIsBot, replyToFromId, botId } = args

    if (replyToBotMessageId && replyToFromIsBot && (!botId || replyToFromId === botId)) {
      const existingThread = this.botMessageToThread.get(replyToBotMessageId)
      if (existingThread !== undefined && this.threads.has(existingThread)) {
        return { threadId: existingThread, created: false }
      }
    }

    const threadId = incomingMessageId
    const now = Date.now()
    if (!this.threads.has(threadId)) {
      this.threads.set(threadId, {
        history: [],
        topic: incomingText.slice(0, 80),
        updated: now,
        created: now,
      })
      return { threadId, created: true }
    }
    return { threadId, created: false }
  }

  getThread(threadId: number): Thread | undefined {
    return this.threads.get(threadId)
  }

  /** Last N exchanges for prompt prefix, scoped to one thread. */
  getHistory(threadId: number, limit = 10): Array<{ role: "user" | "assistant"; content: string }> {
    const t = this.threads.get(threadId)
    if (!t) return []
    return t.history.slice(-limit).map((m) => ({ role: m.role, content: m.content }))
  }

  setSessionId(threadId: number, sessionId: string): void {
    const t = this.threads.get(threadId)
    if (!t) return
    t.sessionId = sessionId
    t.updated = Date.now()
  }

  recordBotMessage(threadId: number, botMessageId: number): void {
    const t = this.threads.get(threadId)
    if (!t) return
    t.lastBotMessageId = botMessageId
    t.updated = Date.now()
    this.botMessageToThread.set(botMessageId, threadId)

    if (this.botMessageToThread.size > this.maxBotMessageEntries) {
      const overflow = this.botMessageToThread.size - this.maxBotMessageEntries
      const it = this.botMessageToThread.keys()
      for (let i = 0; i < overflow; i++) {
        const k = it.next().value
        if (k !== undefined) this.botMessageToThread.delete(k)
      }
    }
  }

  async addExchange(threadId: number, userContent: string, assistantContent: string): Promise<void> {
    const t = this.threads.get(threadId)
    if (!t) return
    const now = Date.now()
    t.history.push(
      { role: "user", content: userContent, timestamp: now },
      { role: "assistant", content: assistantContent, timestamp: now },
    )
    if (t.history.length > this.maxHistoryPerThread) {
      t.history = t.history.slice(-this.maxHistoryPerThread)
    }
    t.updated = now
    await this.persist()
  }

  listThreads(): Array<{ threadId: number; topic: string; messageCount: number; updated: number; created: number }> {
    return [...this.threads.entries()]
      .map(([threadId, t]) => ({
        threadId,
        topic: t.topic,
        messageCount: t.history.length,
        updated: t.updated,
        created: t.created,
      }))
      .sort((a, b) => b.updated - a.updated)
  }

  async clearAll(): Promise<void> {
    this.threads.clear()
    this.botMessageToThread.clear()
    await this.persist()
  }

  size(): { threads: number; botMessages: number } {
    return { threads: this.threads.size, botMessages: this.botMessageToThread.size }
  }

  private pruneStale(): void {
    const cutoff = Date.now() - this.threadStaleMs
    for (const [id, t] of this.threads) {
      if (t.updated < cutoff) {
        this.threads.delete(id)
        if (t.lastBotMessageId !== undefined) this.botMessageToThread.delete(t.lastBotMessageId)
      }
    }
  }

  async persist(): Promise<void> {
    const shape: PersistShape = {
      threads: Object.fromEntries([...this.threads.entries()].map(([k, v]) => [String(k), v])),
      botMessageToThread: Object.fromEntries(
        [...this.botMessageToThread.entries()].map(([k, v]) => [String(k), v]),
      ),
    }
    const tmp = this.path + ".tmp"
    await Bun.write(tmp, JSON.stringify(shape, null, 2))
    const fs = await import("fs/promises")
    await fs.rename(tmp, this.path)
  }
}

export function defaultThreadStorePath(homeDir: string): string {
  return join(homeDir, ".claude", "PAI", "PULSE", "state", "telegram", "threads.json")
}

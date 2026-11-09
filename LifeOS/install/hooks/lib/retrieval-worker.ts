/**
 * retrieval-worker.ts — runs the retriever off the prompt hook's thread, so MemoryTurnStart can stop
 * waiting at its budget and terminate this worker instead of holding the prompt (2026-10-16 native-unblock ISC-18).
 * Message in: the query string, or { query, deadline, transcriptPath } for the opt-in embedding leg (public
 * issue #2207): deadline (epoch ms) is when the hook stops waiting, and with the leg on the previous user
 * messages are read from transcriptPath here, off the hook's thread. Message out: { markdownBlock } or { error }.
 */
import { getRelevantContextAsync } from "../../LIFEOS/TOOLS/MemoryRetriever";
import { embeddingConfig } from "../../LIFEOS/TOOLS/MemoryEmbedding";
import { conversationContext } from "./recent-user-messages";

declare const self: Worker;

self.onmessage = async (e: MessageEvent) => {
  try {
    const msg = e.data;
    const query = typeof msg === "string" ? msg : String(msg?.query ?? "");
    const deadline = typeof msg?.deadline === "number" ? msg.deadline : undefined;
    const transcriptPath = typeof msg?.transcriptPath === "string" ? msg.transcriptPath : undefined;
    const context = transcriptPath && embeddingConfig().enabled ? conversationContext(query, transcriptPath) : undefined;
    const r = await getRelevantContextAsync(query, { topK: 5, threshold: 0.20, allowStaleIndex: true, deadline, context });
    postMessage({ markdownBlock: r.markdownBlock });
  } catch (err) {
    postMessage({ error: err instanceof Error ? err.message : String(err) });
  }
};

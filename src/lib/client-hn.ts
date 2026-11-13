import { fetchThreadJobs, fetchRecentHiringThreads, parseHnInput } from "./hn";
import { MonthlyThreadOption, ThreadResponse } from "./types";

const LOCAL_CACHE_PREFIX = "askhn_thread_cache_v1_";
const LOCAL_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

export async function loadThreadSmart(
  input: string,
  forceRefresh = false
): Promise<{
  data: ThreadResponse;
  highlightCommentId: number | null;
}> {
  const { itemId, hashCommentId } = parseHnInput(input);
  if (!itemId) {
    throw new Error("Please enter a valid Hacker News thread URL or item ID.");
  }

  // 1. Check client localStorage cache if not forcing refresh
  if (!forceRefresh && typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem(`${LOCAL_CACHE_PREFIX}${itemId}`);
      if (raw) {
        const parsed: { data: ThreadResponse; savedAt: number } =
          JSON.parse(raw);
        if (
          Date.now() - parsed.savedAt < LOCAL_CACHE_TTL &&
          (!hashCommentId ||
            parsed.data.jobs.some((j) => j.id === hashCommentId))
        ) {
          return { data: parsed.data, highlightCommentId: hashCommentId };
        }
      }
    } catch {
      // Ignore storage quota or parse errors
    }
  }

  // 2. Try Next.js API route first
  try {
    const params = new URLSearchParams({
      id: String(itemId),
      ...(hashCommentId ? { commentId: String(hashCommentId) } : {}),
      ...(forceRefresh ? { refresh: "true" } : {}),
    });
    const res = await fetch(`/api/jobs?${params.toString()}`);
    if (res.ok) {
      const payload = await res.json();
      saveToLocalCache(itemId, payload);
      return {
        data: { thread: payload.thread, jobs: payload.jobs },
        highlightCommentId: payload.highlightCommentId ?? hashCommentId,
      };
    }
  } catch {
    // Fallback to direct CORS fetch from browser
  }

  // 3. Direct browser fetch fallback (Algolia & Firebase support CORS *)
  const data = await fetchThreadJobs(itemId, forceRefresh, hashCommentId);
  saveToLocalCache(itemId, data);
  return { data, highlightCommentId: hashCommentId };
}

function saveToLocalCache(itemId: number, data: ThreadResponse) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      `${LOCAL_CACHE_PREFIX}${itemId}`,
      JSON.stringify({ data, savedAt: Date.now() })
    );
  } catch {
    // Ignore localStorage quota exceeded
  }
}

export async function loadRecentThreadsSmart(): Promise<MonthlyThreadOption[]> {
  try {
    const res = await fetch("/api/threads");
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.threads) && data.threads.length > 0) {
        return data.threads;
      }
    }
  } catch {
    // Fallback to direct client fetch
  }
  return fetchRecentHiringThreads();
}


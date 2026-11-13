import { parseHNJobComment } from "./parser";
import { MonthlyThreadOption, ParsedJob, ThreadResponse } from "./types";

const ALGOLIA_BASE = "https://hn.algolia.com/api/v1";
const FIREBASE_BASE = "https://hacker-news.firebaseio.com/v0";

// Server-side in-memory cache with 5-minute TTL
const threadCache = new Map<
  number,
  { data: ThreadResponse; expiresAt: number }
>();
const CACHE_TTL_MS = 5 * 60 * 1000;

export function parseHnInput(input: string): {
  itemId: number | null;
  hashCommentId: number | null;
} {
  const trimmed = input.trim();
  if (!trimmed) return { itemId: null, hashCommentId: null };

  // Pure number
  if (/^\d+$/.test(trimmed)) {
    return { itemId: parseInt(trimmed, 10), hashCommentId: null };
  }

  // URL or string with id=... and optional #...
  const idMatch = trimmed.match(/[?&]id=(\d+)/i);
  const hashMatch = trimmed.match(/#(\d+)/);

  if (idMatch) {
    return {
      itemId: parseInt(idMatch[1], 10),
      hashCommentId: hashMatch ? parseInt(hashMatch[1], 10) : null,
    };
  }

  // Fallback: any 7-9 digit number in string
  const anyNum = trimmed.match(/\b(\d{7,9})\b/g);
  if (anyNum && anyNum.length > 0) {
    return {
      itemId: parseInt(anyNum[0], 10),
      hashCommentId: anyNum[1] ? parseInt(anyNum[1], 10) : null,
    };
  }

  return { itemId: null, hashCommentId: null };
}

interface AlgoliaItem {
  id: number;
  created_at_i: number;
  type: "story" | "comment" | "job" | "poll";
  author: string;
  title: string | null;
  text: string | null;
  parent_id: number | null;
  story_id: number | null;
  children?: AlgoliaItem[];
}

interface FirebaseItem {
  id: number;
  type: string;
  by?: string;
  time?: number;
  text?: string;
  parent?: number;
  kids?: number[];
  title?: string;
  deleted?: boolean;
  dead?: boolean;
}

async function fetchSingleCommentIfMissing(
  commentId: number,
  storyId: number
): Promise<ParsedJob | null> {
  try {
    const fbRes = await fetch(`${FIREBASE_BASE}/item/${commentId}.json`, {
      cache: "no-store",
    });
    if (fbRes.ok) {
      const item: FirebaseItem | null = await fbRes.json();
      if (item && item.text && !item.deleted && !item.dead) {
        return parseHNJobComment({
          id: item.id,
          parentId: item.parent || storyId,
          author: item.by || "anonymous",
          createdAt: item.time || Math.floor(Date.now() / 1000),
          rawHtml: item.text,
          repliesCount: item.kids ? item.kids.length : 0,
        });
      }
    }
  } catch {
    // Ignore
  }
  return null;
}

async function fetchFromAlgolia(
  itemId: number
): Promise<{ story: AlgoliaItem; highlightCommentId?: number } | null> {
  try {
    const res = await fetch(`${ALGOLIA_BASE}/items/${itemId}`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    const item: AlgoliaItem = await res.json();

    // If user passed a comment ID instead of the parent story ID, hop to the story!
    if (item.type === "comment" && (item.story_id || item.parent_id)) {
      const targetStoryId = item.story_id || item.parent_id!;
      const storyRes = await fetch(`${ALGOLIA_BASE}/items/${targetStoryId}`, {
        next: { revalidate: 300 },
      });
      if (storyRes.ok) {
        const storyItem: AlgoliaItem = await storyRes.json();
        return { story: storyItem, highlightCommentId: item.id };
      }
    }

    return { story: item };
  } catch {
    return null;
  }
}

async function fetchFromFirebase(
  itemId: number
): Promise<{
  story: FirebaseItem;
  comments: FirebaseItem[];
  highlightCommentId?: number;
} | null> {
  try {
    const res = await fetch(`${FIREBASE_BASE}/item/${itemId}.json`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    let item: FirebaseItem | null = await res.json();
    if (!item) return null;

    let highlightCommentId: number | undefined;
    if (item.type === "comment" && item.parent) {
      highlightCommentId = item.id;
      const parentRes = await fetch(
        `${FIREBASE_BASE}/item/${item.parent}.json`,
        { cache: "no-store" }
      );
      if (parentRes.ok) {
        const parentItem: FirebaseItem | null = await parentRes.json();
        if (parentItem) item = parentItem;
      }
    }

    const kidIds = item.kids || [];
    const comments: FirebaseItem[] = [];
    const BATCH_SIZE = 40;

    for (let i = 0; i < kidIds.length; i += BATCH_SIZE) {
      const slice = kidIds.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(
        slice.map(async (kidId) => {
          try {
            const r = await fetch(`${FIREBASE_BASE}/item/${kidId}.json`, {
              next: { revalidate: 300 },
            });
            if (!r.ok) return null;
            return (await r.json()) as FirebaseItem | null;
          } catch {
            return null;
          }
        })
      );
      for (const c of batchResults) {
        if (c && !c.deleted && !c.dead && c.text) {
          comments.push(c);
        }
      }
    }

    return { story: item, comments, highlightCommentId };
  } catch {
    return null;
  }
}

export async function fetchThreadJobs(
  itemId: number,
  forceRefresh = false,
  targetCommentId?: number | null
): Promise<ThreadResponse> {
  if (!forceRefresh) {
    const cached = threadCache.get(itemId);
    if (cached && cached.expiresAt > Date.now()) {
      if (
        targetCommentId &&
        !cached.data.jobs.some((j) => j.id === targetCommentId)
      ) {
        const extra = await fetchSingleCommentIfMissing(
          targetCommentId,
          cached.data.thread.id
        );
        if (extra) {
          cached.data.jobs.unshift(extra);
          cached.data.thread.totalTopLevel = cached.data.jobs.length;
        }
      }
      return cached.data;
    }
  }

  // Try Algolia first (1 fast request for the entire tree)
  const algoliaResult = await fetchFromAlgolia(itemId);

  if (algoliaResult && algoliaResult.story) {
    const { story } = algoliaResult;
    const rawChildren = (story.children || []).filter(
      (c) => c.text && c.text.trim().length > 0 && c.author
    );

    const jobs: ParsedJob[] = rawChildren
      .map((child) =>
        parseHNJobComment({
          id: child.id,
          parentId: story.id,
          author: child.author || "anonymous",
          createdAt: child.created_at_i,
          rawHtml: child.text || "",
          repliesCount: child.children ? child.children.length : 0,
        })
      )
      .sort((a, b) => b.createdAt - a.createdAt);

    if (targetCommentId && !jobs.some((j) => j.id === targetCommentId)) {
      const extra = await fetchSingleCommentIfMissing(
        targetCommentId,
        story.id
      );
      if (extra) {
        jobs.unshift(extra);
      }
    }

    const response: ThreadResponse = {
      thread: {
        id: story.id,
        title: story.title || `HN Thread #${story.id}`,
        createdAt: story.created_at_i,
        author: story.author || "whoishiring",
        totalTopLevel: jobs.length,
        source: "algolia",
        fetchedAt: Date.now(),
      },
      jobs,
    };

    threadCache.set(itemId, {
      data: response,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
    threadCache.set(story.id, {
      data: response,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    return response;
  }

  // Fallback to Firebase Official API
  const fbResult = await fetchFromFirebase(itemId);
  if (!fbResult) {
    throw new Error(
      `Could not fetch HN thread ${itemId} from Algolia or Firebase.`
    );
  }

  const { story, comments } = fbResult;
  const jobs: ParsedJob[] = comments
    .map((c) =>
      parseHNJobComment({
        id: c.id,
        parentId: story.id,
        author: c.by || "anonymous",
        createdAt: c.time || 0,
        rawHtml: c.text || "",
        repliesCount: c.kids ? c.kids.length : 0,
      })
    )
    .sort((a, b) => b.createdAt - a.createdAt);

  if (targetCommentId && !jobs.some((j) => j.id === targetCommentId)) {
    const extra = await fetchSingleCommentIfMissing(targetCommentId, story.id);
    if (extra) {
      jobs.unshift(extra);
    }
  }

  const response: ThreadResponse = {
    thread: {
      id: story.id,
      title: story.title || `HN Thread #${story.id}`,
      createdAt: story.time || Math.floor(Date.now() / 1000),
      author: story.by || "whoishiring",
      totalTopLevel: jobs.length,
      source: "firebase",
      fetchedAt: Date.now(),
    },
    jobs,
  };

  threadCache.set(itemId, {
    data: response,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });

  return response;
}

export async function fetchRecentHiringThreads(): Promise<
  MonthlyThreadOption[]
> {
  const defaultThread: MonthlyThreadOption = {
    id: 50338728,
    title: "Ask HN: Who is hiring? (Thread #50338728)",
    createdAt: Math.floor(Date.now() / 1000),
  };

  try {
    const res = await fetch(
      `${ALGOLIA_BASE}/search_by_date?tags=story,author_whoishiring&query=%22Who%20is%20hiring%22&hitsPerPage=15`,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) return [defaultThread];
    const data = await res.json();
    const hits: MonthlyThreadOption[] = (data.hits || [])
      .filter((h: { title?: string }) =>
        /who is hiring\?/i.test(h.title || "")
      )
      .map((h: { objectID: string; title: string; created_at_i: number }) => ({
        id: parseInt(h.objectID, 10),
        title: h.title,
        createdAt: h.created_at_i,
      }));

    const hasTarget = hits.some((h) => h.id === 50338728);
    if (!hasTarget) {
      return [defaultThread, ...hits];
    }
    return hits;
  } catch {
    return [defaultThread];
  }
}

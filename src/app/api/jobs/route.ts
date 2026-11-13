import { NextRequest, NextResponse } from "next/server";
import { fetchThreadJobs, parseHnInput } from "@/lib/hn";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const rawInput = searchParams.get("input") || searchParams.get("id") || "50338728";
  const explicitCommentId = searchParams.get("commentId");
  const refresh = searchParams.get("refresh") === "true";

  const { itemId, hashCommentId } = parseHnInput(rawInput);
  if (!itemId) {
    return NextResponse.json(
      { error: "Invalid Hacker News thread ID or URL." },
      { status: 400 }
    );
  }

  const targetCommentId = explicitCommentId
    ? parseInt(explicitCommentId, 10)
    : hashCommentId;

  try {
    const data = await fetchThreadJobs(itemId, refresh, targetCommentId);
    return NextResponse.json({
      ...data,
      highlightCommentId: targetCommentId || null,
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to fetch Hacker News thread.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


import { NextResponse } from "next/server";
import { fetchRecentHiringThreads } from "@/lib/hn";

export async function GET() {
  const threads = await fetchRecentHiringThreads();
  return NextResponse.json({ threads });
}


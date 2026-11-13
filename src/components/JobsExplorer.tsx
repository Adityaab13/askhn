"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import { MonthlyThreadOption, ParsedJob, ThreadMetadata, WorkMode } from "@/lib/types";
import { loadRecentThreadsSmart, loadThreadSmart } from "@/lib/client-hn";
import JobCard from "./JobCard";
import {
  Search,
  RefreshCw,
  Bookmark,
  EyeOff,
  SlidersHorizontal,
  ExternalLink,
  Sparkles,
  Briefcase,
  MapPin,
  DollarSign,
  CheckCircle2,
  X,
  ArrowUpDown,
  AlertCircle,
  Link2,
} from "lucide-react";

const DEFAULT_URL = "https://news.ycombinator.com/item?id=50338728#50460238";
const BOOKMARKS_KEY = "askhn_bookmarked_ids_v1";
const HIDDEN_KEY = "askhn_hidden_ids_v1";

type ViewTab = "all" | "saved" | "hidden";
type SortOption = "newest" | "oldest" | "salary" | "company";

export default function JobsExplorer() {
  const [urlInput, setUrlInput] = useState(DEFAULT_URL);
  const [recentThreads, setRecentThreads] = useState<MonthlyThreadOption[]>([]);
  const [threadMeta, setThreadMeta] = useState<ThreadMetadata | null>(null);
  const [jobs, setJobs] = useState<ParsedJob[]>([]);
  const [highlightId, setHighlightId] = useState<number | null>(50460238);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [locationQuery, setLocationQuery] = useState("");
  const [selectedWorkMode, setSelectedWorkMode] = useState<WorkMode | "ALL">("ALL");
  const [onlyWithSalary, setOnlyWithSalary] = useState(false);
  const [onlyVisaSponsor, setOnlyVisaSponsor] = useState(false);
  const [onlyIntern, setOnlyIntern] = useState(false);
  const [selectedTech, setSelectedTech] = useState<string[]>([]);
  const [viewTab, setViewTab] = useState<ViewTab>("all");
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [visibleCount, setVisibleCount] = useState(30);

  // Persisted state
  const [bookmarkedIds, setBookmarkedIds] = useState<number[]>([]);
  const [hiddenIds, setHiddenIds] = useState<number[]>([]);

  // Load saved & hidden from localStorage
  useEffect(() => {
    try {
      const savedBookmarks = localStorage.getItem(BOOKMARKS_KEY);
      if (savedBookmarks) setBookmarkedIds(JSON.parse(savedBookmarks));
      const savedHidden = localStorage.getItem(HIDDEN_KEY);
      if (savedHidden) setHiddenIds(JSON.parse(savedHidden));
    } catch {
      // ignore
    }
  }, []);

  const toggleBookmark = useCallback((id: number) => {
    setBookmarkedIds((prev) => {
      const next = prev.includes(id)
        ? prev.filter((item) => item !== id)
        : [...prev, id];
      try {
        localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const toggleHide = useCallback((id: number) => {
    setHiddenIds((prev) => {
      const next = prev.includes(id)
        ? prev.filter((item) => item !== id)
        : [...prev, id];
      try {
        localStorage.setItem(HIDDEN_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const toggleTechFilter = useCallback((tech: string) => {
    setSelectedTech((prev) =>
      prev.includes(tech) ? prev.filter((t) => t !== tech) : [...prev, tech]
    );
    setVisibleCount(30);
  }, []);

  const fetchThread = useCallback(async (inputStr: string, force = false) => {
    if (force) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const { data, highlightCommentId } = await loadThreadSmart(inputStr, force);
      setThreadMeta(data.thread);
      setJobs(data.jobs);
      setHighlightId(highlightCommentId);
      setVisibleCount(30);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load Hacker News thread. Check your connection or thread ID."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Initial load of default thread and recent monthly threads
  useEffect(() => {
    fetchThread(DEFAULT_URL, false);
    loadRecentThreadsSmart().then(setRecentThreads).catch(() => {});
  }, [fetchThread]);

  // Compute top tech stack frequencies across current thread
  const topTechCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const job of jobs) {
      for (const t of job.techStack) {
        counts.set(t, (counts.get(t) || 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 14);
  }, [jobs]);

  // Highlighted job object if found
  const highlightedJob = useMemo(() => {
    if (!highlightId) return null;
    return jobs.find((j) => j.id === highlightId) || null;
  }, [jobs, highlightId]);

  // Filtered and sorted jobs
  const filteredJobs = useMemo(() => {
    const bookmarkSet = new Set(bookmarkedIds);
    const hiddenSet = new Set(hiddenIds);

    // Parse search terms (support negative terms like -crypto)
    const tokens = searchQuery
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);
    const positiveTerms = tokens.filter((t) => !t.startsWith("-"));
    const negativeTerms = tokens
      .filter((t) => t.startsWith("-") && t.length > 1)
      .map((t) => t.slice(1));

    const locLower = locationQuery.trim().toLowerCase();

    const list = jobs.filter((job) => {
      // Tab filtering
      if (viewTab === "saved" && !bookmarkSet.has(job.id)) return false;
      if (viewTab === "hidden" && !hiddenSet.has(job.id)) return false;
      if (viewTab === "all" && hiddenSet.has(job.id) && job.id !== highlightId) {
        return false;
      }

      // Work Mode filter
      if (
        selectedWorkMode !== "ALL" &&
        !job.workModes.includes(selectedWorkMode)
      ) {
        return false;
      }

      // Toggles
      if (onlyWithSalary && !job.salaryText) return false;
      if (onlyVisaSponsor && !job.visaSponsor) return false;
      if (onlyIntern && !job.isIntern) return false;

      // Tech stack filter (AND match)
      if (selectedTech.length > 0) {
        for (const tech of selectedTech) {
          if (!job.techStack.includes(tech)) return false;
        }
      }

      // Location filter
      if (locLower) {
        const locHaystack =
          `${job.locations.join(" ")} ${job.headerRaw}`.toLowerCase();
        if (!locHaystack.includes(locLower)) return false;
      }

      // Full-text search
      if (positiveTerms.length > 0 || negativeTerms.length > 0) {
        const haystack = `${job.company} ${job.roles.join(" ")} ${job.locations.join(
          " "
        )} ${job.techStack.join(" ")} ${job.plainText}`.toLowerCase();

        for (const term of positiveTerms) {
          if (!haystack.includes(term)) return false;
        }
        for (const neg of negativeTerms) {
          if (haystack.includes(neg)) return false;
        }
      }

      return true;
    });

    // Sort
    list.sort((a, b) => {
      // Always pin the URL-highlighted comment to the top when on "all" tab and no active search
      if (a.id === highlightId && b.id !== highlightId) return -1;
      if (b.id === highlightId && a.id !== highlightId) return 1;

      if (sortBy === "newest") return b.createdAt - a.createdAt;
      if (sortBy === "oldest") return a.createdAt - b.createdAt;
      if (sortBy === "salary") {
        const salA = a.salaryMaxK ?? -1;
        const salB = b.salaryMaxK ?? -1;
        if (salB !== salA) return salB - salA;
        return b.createdAt - a.createdAt;
      }
      if (sortBy === "company") {
        return a.company.localeCompare(b.company);
      }
      return 0;
    });

    return list;
  }, [
    jobs,
    bookmarkedIds,
    hiddenIds,
    viewTab,
    selectedWorkMode,
    onlyWithSalary,
    onlyVisaSponsor,
    onlyIntern,
    selectedTech,
    locationQuery,
    searchQuery,
    sortBy,
    highlightId,
  ]);

  // Quick stats
  const stats = useMemo(() => {
    let remote = 0;
    let withSalary = 0;
    let visa = 0;
    for (const j of jobs) {
      if (j.workModes.includes("Remote")) remote++;
      if (j.salaryText) withSalary++;
      if (j.visaSponsor) visa++;
    }
    return { total: jobs.length, remote, withSalary, visa };
  }, [jobs]);

  const clearAllFilters = () => {
    setSearchQuery("");
    setLocationQuery("");
    setSelectedWorkMode("ALL");
    setOnlyWithSalary(false);
    setOnlyVisaSponsor(false);
    setOnlyIntern(false);
    setSelectedTech([]);
    setVisibleCount(30);
  };

  const hasActiveFilters =
    searchQuery.trim() !== "" ||
    locationQuery.trim() !== "" ||
    selectedWorkMode !== "ALL" ||
    onlyWithSalary ||
    onlyVisaSponsor ||
    onlyIntern ||
    selectedTech.length > 0;

  return (
    <div className="min-h-screen bg-[#f8f9fa] text-slate-900">
      {/* Top Header */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-3.5 sm:px-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            {/* Brand */}
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 font-bold text-white shadow-sm">
                Y
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg font-bold tracking-tight text-slate-900">
                    HN Smart Jobs Explorer
                  </h1>
                  <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-semibold text-orange-800">
                    Who is hiring?
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  Structured header parsing, instant tech/remote filtering & deep-link comment pinning
                </p>
              </div>
            </div>

            {/* Thread Switcher & URL Input */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                fetchThread(urlInput, false);
              }}
              className="flex flex-1 flex-wrap items-center gap-2 md:max-w-xl md:justify-end"
            >
              {recentThreads.length > 0 && (
                <select
                  aria-label="Select monthly thread"
                  value={threadMeta?.id || ""}
                  onChange={(e) => {
                    const selectedId = e.target.value;
                    if (selectedId) {
                      const nextUrl = `https://news.ycombinator.com/item?id=${selectedId}`;
                      setUrlInput(nextUrl);
                      fetchThread(nextUrl, false);
                    }
                  }}
                  className="max-w-[210px] truncate rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:border-orange-500 focus:bg-white focus:outline-none"
                >
                  {recentThreads.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title.replace(/^Ask HN:\s*/i, "")} (#{t.id})
                    </option>
                  ))}
                </select>
              )}

              <div className="relative flex-1 min-w-[220px]">
                <Link2 className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="Paste HN thread URL or ID (e.g. 50338728#50460238)"
                  className="w-full rounded-lg border border-slate-200 bg-white pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/15"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-orange-700 disabled:opacity-50"
              >
                Load
              </button>

              <button
                type="button"
                onClick={() => fetchThread(urlInput, true)}
                disabled={loading || refreshing}
                title="Force refresh from Hacker News API"
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${refreshing ? "animate-spin text-orange-600" : ""}`}
                />
                <span className="hidden sm:inline">Refresh</span>
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        {/* Thread Summary & Quick Metrics Banner */}
        {threadMeta && (
          <div className="mb-5 flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">
                  {threadMeta.title}
                </h2>
                <a
                  href={`https://news.ycombinator.com/item?id=${threadMeta.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 hover:bg-orange-50 hover:text-orange-600"
                >
                  Thread #{threadMeta.id}
                  <ExternalLink className="h-3 w-3" />
                </a>
                <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 border border-emerald-200">
                  API: {threadMeta.source === "algolia" ? "HN Algolia Tree" : "HN Firebase"}
                </span>
              </div>

              {highlightId && (
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                  <span className="inline-flex items-center gap-1 font-medium text-orange-700">
                    <Sparkles className="h-3.5 w-3.5 text-orange-500" />
                    Target comment #{highlightId}:
                  </span>
                  {highlightedJob ? (
                    <a
                      href={`#job-${highlightId}`}
                      className="font-semibold text-orange-600 underline hover:text-orange-700"
                    >
                      Pinned at top ({highlightedJob.company})
                    </a>
                  ) : (
                    <span className="text-slate-500">
                      Not found in top-level postings of #{threadMeta.id}{" "}
                      <a
                        href={`https://news.ycombinator.com/item?id=${highlightId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-orange-600 underline"
                      >
                        (view item #{highlightId} on HN)
                      </a>
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Stats Pills */}
            <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
              <div className="rounded-xl bg-slate-50 px-3 py-2 text-center border border-slate-100">
                <div className="text-base font-bold text-slate-900">
                  {stats.total}
                </div>
                <div className="text-[11px] font-medium text-slate-500">
                  Total Jobs
                </div>
              </div>
              <div className="rounded-xl bg-emerald-50/70 px-3 py-2 text-center border border-emerald-100">
                <div className="text-base font-bold text-emerald-700">
                  {stats.remote}
                </div>
                <div className="text-[11px] font-medium text-emerald-600">
                  Remote Friendly
                </div>
              </div>
              <div className="rounded-xl bg-green-50/70 px-3 py-2 text-center border border-green-100">
                <div className="text-base font-bold text-green-700">
                  {stats.withSalary}
                </div>
                <div className="text-[11px] font-medium text-green-600">
                  Salary Listed
                </div>
              </div>
              <div className="rounded-xl bg-purple-50/70 px-3 py-2 text-center border border-purple-100">
                <div className="text-base font-bold text-purple-700">
                  {stats.visa}
                </div>
                <div className="text-[11px] font-medium text-purple-600">
                  Visa Sponsor
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Smart Search & Filter Controls */}
        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-4">
          {/* Row 1: Search + Location + Sort */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
            <div className="relative md:col-span-6">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setVisibleCount(30);
                }}
                placeholder="Search company, role, keyword (tip: use -crypto to exclude)..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50/60 pl-9 pr-8 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-orange-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/15"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="relative md:col-span-3">
              <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={locationQuery}
                onChange={(e) => {
                  setLocationQuery(e.target.value);
                  setVisibleCount(30);
                }}
                placeholder="Location (e.g. NYC, SF, Europe, US)"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/60 pl-9 pr-8 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-orange-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/15"
              />
              {locationQuery && (
                <button
                  type="button"
                  onClick={() => setLocationQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="relative md:col-span-3">
              <ArrowUpDown className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <select
                aria-label="Sort jobs"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/60 pl-9 pr-3 py-2 text-sm font-medium text-slate-700 focus:border-orange-500 focus:bg-white focus:outline-none"
              >
                <option value="newest">Sort: Newest First</option>
                <option value="salary">Sort: Highest Salary</option>
                <option value="company">Sort: Company (A–Z)</option>
                <option value="oldest">Sort: Oldest First</option>
              </select>
            </div>
          </div>

          {/* Row 2: Work Mode Pills + Smart Checkboxes */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 mr-1">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Mode:
              </span>
              {(["ALL", "Remote", "Hybrid", "Onsite"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => {
                    setSelectedWorkMode(mode);
                    setVisibleCount(30);
                  }}
                  className={`rounded-lg px-3 py-1 text-xs font-semibold transition ${
                    selectedWorkMode === mode
                      ? "bg-slate-900 text-white shadow-sm"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {mode === "ALL" ? "All Modes" : mode}
                </button>
              ))}

              <div className="mx-1 h-4 w-px bg-slate-200 hidden sm:block" />

              {/* Smart Toggles */}
              <button
                type="button"
                onClick={() => {
                  setOnlyWithSalary((v) => !v);
                  setVisibleCount(30);
                }}
                className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium transition ${
                  onlyWithSalary
                    ? "border-green-300 bg-green-100 text-green-900"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                <DollarSign className="h-3.5 w-3.5" />
                Has Salary
              </button>

              <button
                type="button"
                onClick={() => {
                  setOnlyVisaSponsor((v) => !v);
                  setVisibleCount(30);
                }}
                className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium transition ${
                  onlyVisaSponsor
                    ? "border-purple-300 bg-purple-100 text-purple-900"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Visa Sponsor
              </button>

              <button
                type="button"
                onClick={() => {
                  setOnlyIntern((v) => !v);
                  setVisibleCount(30);
                }}
                className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium transition ${
                  onlyIntern
                    ? "border-cyan-300 bg-cyan-100 text-cyan-900"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                <Briefcase className="h-3.5 w-3.5" />
                Internships
              </button>
            </div>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 hover:text-rose-700"
              >
                <X className="h-3.5 w-3.5" />
                Reset Filters
              </button>
            )}
          </div>

          {/* Row 3: Popular Tech Stack Pills */}
          {topTechCounts.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-3">
              <span className="text-xs font-semibold text-slate-500 mr-1">
                Top Tech:
              </span>
              {topTechCounts.map(([tech, count]) => {
                const active = selectedTech.includes(tech);
                return (
                  <button
                    key={tech}
                    type="button"
                    onClick={() => toggleTechFilter(tech)}
                    className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                      active
                        ? "bg-orange-600 text-white shadow-sm"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    <span>{tech}</span>
                    <span
                      className={`rounded px-1 text-[10px] ${
                        active
                          ? "bg-orange-700 text-orange-100"
                          : "bg-slate-200/80 text-slate-500"
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* View Tabs (All / Saved / Hidden) & Count */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
            <button
              type="button"
              onClick={() => setViewTab("all")}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                viewTab === "all"
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              All Postings ({jobs.length - hiddenIds.length})
            </button>
            <button
              type="button"
              onClick={() => setViewTab("saved")}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                viewTab === "saved"
                  ? "bg-amber-500 text-white"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Bookmark className="h-3.5 w-3.5" />
              Saved ({bookmarkedIds.length})
            </button>
            <button
              type="button"
              onClick={() => setViewTab("hidden")}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                viewTab === "hidden"
                  ? "bg-rose-600 text-white"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <EyeOff className="h-3.5 w-3.5" />
              Hidden ({hiddenIds.length})
            </button>
          </div>

          <div className="text-xs font-medium text-slate-500">
            Showing{" "}
            <span className="font-bold text-slate-800">
              {filteredJobs.length}
            </span>{" "}
            matching {filteredJobs.length === 1 ? "job" : "jobs"}
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((n) => (
              <div
                key={n}
                className="animate-pulse rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-3"
              >
                <div className="flex items-center gap-3">
                  <div className="h-5 w-48 rounded bg-slate-200" />
                  <div className="h-5 w-16 rounded-full bg-slate-100" />
                  <div className="h-5 w-24 rounded-full bg-slate-100" />
                </div>
                <div className="h-4 w-3/4 rounded bg-slate-100" />
                <div className="h-20 w-full rounded bg-slate-50" />
              </div>
            ))}
          </div>
        )}

        {/* Error State */}
        {!loading && error && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center">
            <AlertCircle className="mx-auto h-8 w-8 text-rose-500" />
            <h3 className="mt-2 text-base font-bold text-rose-900">
              Could not fetch HN thread
            </h3>
            <p className="mt-1 text-xs text-rose-700">{error}</p>
            <button
              type="button"
              onClick={() => fetchThread(urlInput, true)}
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Try Again
            </button>
          </div>
        )}

        {/* Job Listings */}
        {!loading && !error && (
          <>
            {filteredJobs.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
                <Briefcase className="mx-auto h-10 w-10 text-slate-300" />
                <h3 className="mt-3 text-base font-bold text-slate-800">
                  No matching jobs found
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Try adjusting your search keywords, location, or active tech stack filters.
                </p>
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={clearAllFilters}
                    className="mt-4 rounded-lg bg-orange-600 px-4 py-2 text-xs font-semibold text-white hover:bg-orange-700"
                  >
                    Clear All Filters
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {filteredJobs.slice(0, visibleCount).map((job) => (
                  <JobCard
                    key={job.id}
                    job={job}
                    isBookmarked={bookmarkedIds.includes(job.id)}
                    isHidden={hiddenIds.includes(job.id)}
                    isHighlighted={job.id === highlightId}
                    selectedTech={selectedTech}
                    onToggleBookmark={toggleBookmark}
                    onToggleHide={toggleHide}
                    onToggleTechFilter={toggleTechFilter}
                  />
                ))}

                {visibleCount < filteredJobs.length && (
                  <div className="pt-4 text-center">
                    <button
                      type="button"
                      onClick={() => setVisibleCount((prev) => prev + 40)}
                      className="rounded-xl border border-slate-300 bg-white px-6 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50"
                    >
                      Load More Jobs ({filteredJobs.length - visibleCount} remaining)
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}


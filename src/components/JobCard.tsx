"use client";

import React, { useState } from "react";
import { ParsedJob } from "@/lib/types";
import {
  Bookmark,
  ExternalLink,
  EyeOff,
  Globe,
  Mail,
  MapPin,
  DollarSign,
  ChevronDown,
  ChevronUp,
  Sparkles,
  CheckCircle2,
  Clock,
  MessageSquare,
} from "lucide-react";

interface JobCardProps {
  job: ParsedJob;
  isBookmarked: boolean;
  isHidden: boolean;
  isHighlighted: boolean;
  selectedTech: string[];
  onToggleBookmark: (id: number) => void;
  onToggleHide: (id: number) => void;
  onToggleTechFilter: (tech: string) => void;
}

function formatRelativeTime(unixSeconds: number): string {
  if (!unixSeconds) return "";
  const diffSec = Math.max(0, Math.floor(Date.now() / 1000) - unixSeconds);
  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  const date = new Date(unixSeconds * 1000);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function JobCard({
  job,
  isBookmarked,
  isHidden,
  isHighlighted,
  selectedTech,
  onToggleBookmark,
  onToggleHide,
  onToggleTechFilter,
}: JobCardProps) {
  const [expanded, setExpanded] = useState(isHighlighted);

  const isLongPost = job.plainText.length > 520;

  return (
    <article
      id={`job-${job.id}`}
      className={`group relative rounded-xl border transition-all duration-200 ${
        isHighlighted
          ? "border-orange-500 bg-orange-50/40 ring-2 ring-orange-500/20 shadow-md"
          : isBookmarked
          ? "border-amber-300 bg-amber-50/20 shadow-sm hover:border-amber-400"
          : "border-slate-200 bg-white shadow-sm hover:border-slate-300 hover:shadow"
      } ${isHidden ? "opacity-60" : ""}`}
    >
      {/* Highlight Banner */}
      {isHighlighted && (
        <div className="flex items-center justify-between rounded-t-xl bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-1.5 text-xs font-medium text-white">
          <span className="flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5" />
            Linked Comment #{job.id} from URL
          </span>
          <a
            href={`https://news.ycombinator.com/item?id=${job.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-orange-100"
          >
            View on HN
          </a>
        </div>
      )}

      <div className="p-5">
        {/* Top Row: Company + Metadata + Actions */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-bold tracking-tight text-slate-900">
                {job.companyUrl ? (
                  <a
                    href={job.companyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 hover:text-orange-600 hover:underline"
                  >
                    {job.company}
                    <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
                  </a>
                ) : (
                  job.company
                )}
              </h3>

              {/* Work Mode Badges */}
              {job.workModes.map((mode) => (
                <span
                  key={mode}
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    mode === "Remote"
                      ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                      : mode === "Hybrid"
                      ? "bg-amber-100 text-amber-800 border border-amber-200"
                      : "bg-blue-100 text-blue-800 border border-blue-200"
                  }`}
                >
                  {mode}
                </span>
              ))}

              {/* Visa Badge */}
              {job.visaSponsor && (
                <span className="inline-flex items-center gap-1 rounded-full border border-purple-200 bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-800">
                  <CheckCircle2 className="h-3 w-3" />
                  Visa Sponsor
                </span>
              )}

              {/* Intern Badge */}
              {job.isIntern && (
                <span className="inline-flex items-center rounded-full border border-cyan-200 bg-cyan-100 px-2.5 py-0.5 text-xs font-medium text-cyan-800">
                  Internship
                </span>
              )}

              {/* Salary Badge */}
              {job.salaryText && (
                <span className="inline-flex items-center gap-0.5 rounded-full border border-green-200 bg-green-50 px-2.5 py-0.5 text-xs font-semibold text-green-800">
                  <DollarSign className="h-3 w-3" />
                  {job.salaryText}
                </span>
              )}
            </div>

            {/* Roles */}
            {job.roles.length > 0 && (
              <div className="text-sm font-medium text-slate-700">
                {job.roles.join(" • ")}
              </div>
            )}

            {/* Locations */}
            {job.locations.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                <span>{job.locations.join(" | ")}</span>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1.5 self-start">
            <button
              type="button"
              onClick={() => onToggleBookmark(job.id)}
              title={isBookmarked ? "Remove Bookmark" : "Bookmark Job"}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                isBookmarked
                  ? "border-amber-300 bg-amber-100 text-amber-900"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <Bookmark
                className={`h-3.5 w-3.5 ${
                  isBookmarked ? "fill-amber-500 text-amber-600" : ""
                }`}
              />
              <span>{isBookmarked ? "Saved" : "Save"}</span>
            </button>

            <button
              type="button"
              onClick={() => onToggleHide(job.id)}
              title={isHidden ? "Unhide Job" : "Dismiss / Hide Job"}
              className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                isHidden
                  ? "border-rose-200 bg-rose-50 text-rose-700"
                  : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-800"
              }`}
            >
              <EyeOff className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">
                {isHidden ? "Hidden" : "Hide"}
              </span>
            </button>
          </div>
        </div>

        {/* Raw Header Bar for quick scannability */}
        {job.isStructured && (
          <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 font-mono text-xs text-slate-600 border border-slate-100">
            {job.headerRaw}
          </div>
        )}

        {/* Tech Stack Tags */}
        {job.techStack.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {job.techStack.map((tech) => {
              const active = selectedTech.includes(tech);
              return (
                <button
                  key={tech}
                  type="button"
                  onClick={() => onToggleTechFilter(tech)}
                  className={`rounded-md px-2 py-0.5 text-xs font-medium transition-colors ${
                    active
                      ? "bg-orange-600 text-white shadow-sm"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  {tech}
                </button>
              );
            })}
          </div>
        )}

        {/* Description Body */}
        <div className="mt-3.5">
          <div
            className={`prose prose-sm max-w-none text-slate-700 prose-a:text-orange-600 prose-a:no-underline hover:prose-a:underline prose-p:my-2 overflow-hidden transition-all ${
              !expanded && isLongPost ? "max-h-36 relative" : ""
            }`}
          >
            <div
              className="text-sm leading-relaxed space-y-2 break-words [&_p]:mt-2 [&_a]:text-orange-600 [&_a]:underline [&_pre]:bg-slate-100 [&_pre]:p-2 [&_pre]:rounded [&_pre]:overflow-x-auto"
              dangerouslySetInnerHTML={{ __html: job.bodyHtml }}
            />
            {!expanded && isLongPost && (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-white to-transparent" />
            )}
          </div>

          {isLongPost && (
            <button
              type="button"
              onClick={() => setExpanded((prev) => !prev)}
              className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-orange-600 hover:text-orange-700"
            >
              {expanded ? (
                <>
                  Show less <ChevronUp className="h-3.5 w-3.5" />
                </>
              ) : (
                <>
                  Read full description <ChevronDown className="h-3.5 w-3.5" />
                </>
              )}
            </button>
          )}
        </div>

        {/* Footer: Quick Links, Emails, Author & Timestamp */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs text-slate-500">
          <div className="flex flex-wrap items-center gap-3">
            {job.applyUrls.slice(0, 2).map((url, idx) => {
              let hostname = "Website";
              try {
                hostname = new URL(url).hostname.replace(/^www\./, "");
              } catch {
                // ignore
              }
              return (
                <a
                  key={url + idx}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-medium text-slate-700 hover:text-orange-600"
                >
                  <Globe className="h-3.5 w-3.5 text-slate-400" />
                  {hostname}
                </a>
              );
            })}

            {job.emails.slice(0, 2).map((email) => (
              <a
                key={email}
                href={`mailto:${email}`}
                className="inline-flex items-center gap-1 font-medium text-slate-700 hover:text-orange-600"
              >
                <Mail className="h-3.5 w-3.5 text-slate-400" />
                {email}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-3 text-slate-400">
            <span>by @{job.author}</span>
            {job.createdAt > 0 && (
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatRelativeTime(job.createdAt)}
              </span>
            )}
            {job.repliesCount > 0 && (
              <span className="inline-flex items-center gap-1">
                <MessageSquare className="h-3 w-3" />
                {job.repliesCount}
              </span>
            )}
            <a
              href={`https://news.ycombinator.com/item?id=${job.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-slate-500 hover:text-orange-600"
            >
              #{job.id}
            </a>
          </div>
        </div>
      </div>
    </article>
  );
}


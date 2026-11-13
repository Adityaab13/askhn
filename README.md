# HN Smart Jobs Explorer

A Next.js application that smartly fetches, parses, and filters job postings from Hacker News **"Ask HN: Who is hiring?"** threads (pre-configured for [`https://news.ycombinator.com/item?id=50338728#50460238`](https://news.ycombinator.com/item?id=50338728#50460238)).

## Features

- **Smart Structured Header Parsing** (`src/lib/parser.ts`):
  - Automatically splits `Company | Role | Location | Remote/Hybrid/Onsite | Salary | URL` pipe- and dash-delimited comment headers.
  - Detects work modes (`Remote`, `Hybrid`, `Onsite`), visa sponsorship (`Visa Sponsor` vs `No Visa`), internships, and salary ranges (normalized to max `$k` for sorting).
  - Extracts 25+ tech stack tags (`TypeScript`, `React`, `Next.js`, `Python`, `Go`, `Rust`, `AI / LLM`, `Kubernetes`, etc.), apply links, and contact emails.
- **Official HN API Integration + Caching** (`src/lib/hn.ts`, `src/lib/client-hn.ts`):
  - Uses the Algolia HN API (`/api/v1/items/:id`) to fetch the full comment tree in a single request, with automatic fallback to the official Firebase HN API (`/v0/item/:id.json`).
  - Supports deep-linking to specific comment hashes (like `#50460238`) and pins the target job at the top of the list.
  - Server-side in-memory caching + browser `localStorage` caching with one-click on-demand refresh.
- **Interactive Search, Filters & Saved Jobs** (`src/components/JobsExplorer.tsx`):
  - Full-text search with negative keyword support (e.g. `typescript -crypto`).
  - Filter by location, work mode, salary presence, visa sponsorship, internships, and top tech stack tags.
  - Bookmark/save jobs and hide/dismiss unwanted listings (persisted in `localStorage`).
  - Switch between recent monthly "Who is hiring?" threads or paste any HN thread URL/ID.

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.


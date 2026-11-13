export type WorkMode = "Remote" | "Onsite" | "Hybrid";

export interface ParsedJob {
  id: number;
  parentId: number;
  author: string;
  createdAt: number; // Unix seconds
  rawHtml: string;
  headerRaw: string;
  bodyHtml: string;
  plainText: string;
  company: string;
  companyUrl: string | null;
  roles: string[];
  locations: string[];
  workModes: WorkMode[];
  visaSponsor: boolean;
  noVisa: boolean;
  isIntern: boolean;
  salaryText: string | null;
  salaryMaxK: number | null;
  techStack: string[];
  applyUrls: string[];
  emails: string[];
  isStructured: boolean;
  repliesCount: number;
}

export interface ThreadMetadata {
  id: number;
  title: string;
  createdAt: number;
  author: string;
  totalTopLevel: number;
  source: "algolia" | "firebase";
  fetchedAt: number;
  targetCommentExists?: boolean;
}

export interface ThreadResponse {
  thread: ThreadMetadata;
  jobs: ParsedJob[];
}

export interface MonthlyThreadOption {
  id: number;
  title: string;
  createdAt: number;
}


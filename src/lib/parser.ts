import { ParsedJob, WorkMode } from "./types";

const TECH_KEYWORDS: { label: string; regex: RegExp }[] = [
  { label: "TypeScript", regex: /\b(typescript|ts)\b/i },
  { label: "React", regex: /\b(react|reactjs|react\.js)\b/i },
  { label: "Next.js", regex: /\b(next\.js|nextjs)\b/i },
  { label: "Node.js", regex: /\b(node\.js|nodejs)\b/i },
  { label: "Python", regex: /\b(python)\b/i },
  { label: "Go", regex: /\b(golang|go\b)/i },
  { label: "Rust", regex: /\b(rust)\b/i },
  { label: "Java", regex: /\b(java|jvm)\b/i },
  { label: "Kotlin", regex: /\b(kotlin)\b/i },
  { label: "Swift", regex: /\b(swift|ios)\b/i },
  { label: "C++", regex: /\b(c\+\+|cpp)\b/i },
  { label: "C#", regex: /\b(c#|\.net|dotnet)\b/i },
  { label: "Ruby", regex: /\b(ruby|rails|ror)\b/i },
  { label: "Elixir", regex: /\b(elixir|erlang)\b/i },
  { label: "PostgreSQL", regex: /\b(postgres|postgresql)\b/i },
  { label: "GraphQL", regex: /\b(graphql)\b/i },
  { label: "Kubernetes", regex: /\b(kubernetes|k8s)\b/i },
  { label: "Docker", regex: /\b(docker)\b/i },
  { label: "AWS", regex: /\b(aws|amazon web services)\b/i },
  { label: "GCP", regex: /\b(gcp|google cloud)\b/i },
  { label: "Azure", regex: /\b(azure)\b/i },
  { label: "Terraform", regex: /\b(terraform)\b/i },
  { label: "AI / LLM", regex: /\b(llm|llms|genai|generative ai|openai|anthropic|langchain|rag)\b/i },
  { label: "Machine Learning", regex: /\b(machine learning|pytorch|tensorflow|\bml\b)\b/i },
  { label: "Vue", regex: /\b(vue|vuejs|vue\.js)\b/i },
  { label: "Svelte", regex: /\b(svelte|sveltekit)\b/i },
];

const ROLE_REGEX =
  /\b(engineer|engineering|developer|dev|swe|sre|devops|architect|designer|product|manager|lead|staff|principal|senior|founding|founder|head of|vp|director|cto|scientist|researcher|analyst|security|frontend|front-end|backend|back-end|fullstack|full-stack|ios|android|mobile|data|ml|ai|platform|infra|infrastructure|systems|compiler|robotics|embedded|qa|test|intern|internship|multiple roles|various roles|all roles|hiring)\b/i;

const LOCATION_REGEX =
  /\b(sf|san francisco|bay area|nyc|new york|brooklyn|manhattan|seattle|austin|boston|cambridge|los angeles|la|chicago|denver|boulder|atlanta|miami|washington|dc|palo alto|mountain view|menlo park|sunnyvale|san mateo|redwood city|san diego|portland|toronto|vancouver|montreal|waterloo|london|uk|united kingdom|berlin|munich|germany|paris|france|amsterdam|netherlands|dublin|ireland|zurich|switzerland|stockholm|sweden|madrid|barcelona|spain|lisbon|portugal|warsaw|poland|prague|tallinn|estonia|tel aviv|israel|tokyo|japan|singapore|sydney|melbourne|australia|bangalore|bengaluru|india|hyderabad|pune|taipei|seoul|latam|latin america|eu|europe|us|usa|united states|north america|canada|apac|global|worldwide|anywhere)\b/i;

const US_STATE_ABBR_REGEX = /,\s*(CA|NY|TX|WA|MA|CO|IL|GA|FL|VA|MD|DC|PA|NC|OR|UT|AZ|MN|OH|MI|NJ)\b/;

export function decodeHtmlEntities(html: string): string {
  return html
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&#x2F;/g, "/")
    .replace(/&nbsp;/g, " ");
}

export function stripHtmlToText(html: string): string {
  const withNewlines = html
    .replace(/<p\s*\/?>/gi, "\n\n")
    .replace(/<br\s*\/?>/gi, "\n");
  const withoutTags = withNewlines.replace(/<[^>]+>/g, "");
  return decodeHtmlEntities(withoutTags).trim();
}

export function extractHrefUrls(html: string): string[] {
  const urls = new Set<string>();
  const hrefRegex = /href=["']([^"']+)["']/gi;
  let match: RegExpExecArray | null;
  while ((match = hrefRegex.exec(html)) !== null) {
    const url = decodeHtmlEntities(match[1]).trim();
    if (url.startsWith("http://") || url.startsWith("https://")) {
      urls.add(url);
    }
  }
  const plainUrlRegex = /https?:\/\/[^\s<>"')]+/gi;
  const decoded = decodeHtmlEntities(html.replace(/<[^>]+>/g, " "));
  while ((match = plainUrlRegex.exec(decoded)) !== null) {
    const cleanUrl = match[0].replace(/[.,;:!?]+$/, "");
    urls.add(cleanUrl);
  }
  return Array.from(urls);
}

export function extractEmails(text: string): string[] {
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
  const matches = text.match(emailRegex) || [];
  return Array.from(new Set(matches));
}

function parseSalaryMaxK(salarySegment: string): number | null {
  // Look for patterns like $180k, $150,000, $160k-$220k, 200K USD
  const kMatches = Array.from(
    salarySegment.matchAll(/[$£€]?\s*(\d{2,3})\s*[kK]\b/g)
  ).map((m) => parseInt(m[1], 10));

  const fullMatches = Array.from(
    salarySegment.matchAll(/[$£€]\s*(\d{3}),(\d{3})\b/g)
  ).map((m) => parseInt(m[1], 10));

  const allValues = [...kMatches, ...fullMatches].filter(
    (v) => v >= 40 && v <= 950
  );
  if (allValues.length === 0) return null;
  return Math.max(...allValues);
}

export function parseHNJobComment(rawComment: {
  id: number;
  parentId: number;
  author: string;
  createdAt: number;
  rawHtml: string;
  repliesCount?: number;
}): ParsedJob {
  const rawHtml = rawComment.rawHtml || "";

  // Split first paragraph / line from body
  // In HN HTML, paragraphs are separated by <p> tags
  const pIndex = rawHtml.search(/<p\b[^>]*>/i);
  let headerHtml = pIndex !== -1 ? rawHtml.slice(0, pIndex) : rawHtml;
  let bodyHtml = pIndex !== -1 ? rawHtml.slice(pIndex) : "";

  // If no <p> tag, check if there is a newline
  if (pIndex === -1 && rawHtml.includes("\n")) {
    const nlIndex = rawHtml.indexOf("\n");
    headerHtml = rawHtml.slice(0, nlIndex);
    bodyHtml = rawHtml.slice(nlIndex + 1);
  }

  const headerUrls = extractHrefUrls(headerHtml);
  const allUrls = extractHrefUrls(rawHtml);
  const headerText = stripHtmlToText(headerHtml).replace(/\s+/g, " ").trim();
  const plainText = stripHtmlToText(rawHtml);
  const emails = extractEmails(plainText);

  // Determine if pipe-separated
  let segments: string[] = [];
  if (headerText.includes("|")) {
    segments = headerText
      .split("|")
      .map((s) => s.trim())
      .filter(Boolean);
  } else if (headerText.split(" - ").length >= 3) {
    segments = headerText
      .split(" - ")
      .map((s) => s.trim())
      .filter(Boolean);
  } else if (headerText.split(" • ").length >= 3) {
    segments = headerText
      .split(" • ")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  const isStructured = segments.length >= 2;

  let company = "Unknown Company";
  let companyUrl: string | null = headerUrls[0] || allUrls[0] || null;
  const roles: string[] = [];
  const locations: string[] = [];
  const workModesSet = new Set<WorkMode>();
  let visaSponsor = false;
  let noVisa = false;
  let isIntern = false;
  let salaryText: string | null = null;
  let salaryMaxK: number | null = null;

  if (isStructured) {
    // Segment 0 is Company
    let rawCompany = segments[0]
      .replace(/https?:\/\/[^\s)]+/gi, "")
      .replace(/\(\s*\)/g, "")
      .trim();

    if (rawCompany.length > 75) {
      rawCompany = rawCompany.slice(0, 72) + "...";
    }
    company = rawCompany || "Unknown Company";

    for (let i = 1; i < segments.length; i++) {
      const seg = segments[i];
      const lower = seg.toLowerCase();

      // Skip pure URLs
      if (/^https?:\/\/\S+$/i.test(seg)) {
        if (!companyUrl) companyUrl = seg;
        continue;
      }

      // Check Work Mode
      let matchedWorkMode = false;
      if (/\b(remote|wfh|work from home|distributed|anywhere)\b/i.test(lower)) {
        workModesSet.add("Remote");
        matchedWorkMode = true;
      }
      if (/\b(hybrid)\b/i.test(lower)) {
        workModesSet.add("Hybrid");
        matchedWorkMode = true;
      }
      if (/\b(onsite|on-site|in-office|in office|in-person)\b/i.test(lower)) {
        workModesSet.add("Onsite");
        matchedWorkMode = true;
      }

      // Check Visa
      if (/\b(no visa|no sponsorship|cannot sponsor|can't sponsor|us citizens only)\b/i.test(lower)) {
        noVisa = true;
      } else if (/\b(visa|h1b|h-1b|sponsorship|sponsor)\b/i.test(lower)) {
        visaSponsor = true;
      }

      // Check Intern
      if (/\b(intern|internship|interns|co-op)\b/i.test(lower)) {
        isIntern = true;
      }

      // Check Salary
      const hasSalaryIndicator =
        /([$£€]\s*\d+|\b\d{2,3}\s*k\b|\b(usd|eur|gbp|cad|chf)\b|\bcompensation\b|\bsalary\b)/i.test(
          seg
        );
      if (hasSalaryIndicator && !salaryText) {
        salaryText = seg;
        salaryMaxK = parseSalaryMaxK(seg);
        continue;
      }

      // Check Location vs Role
      const looksLikeLocation =
        LOCATION_REGEX.test(seg) || US_STATE_ABBR_REGEX.test(seg);
      const looksLikeRole = ROLE_REGEX.test(seg);

      // Pure employment type segment (e.g. "Full-time", "Full Time", "FT")
      const isPureEmploymentType =
        /^(full[\s-]?time|part[\s-]?time|contract|ft|pt|permanent|full[\s-]?time\s*\/?\s*onsite|remote|onsite|on-site|hybrid|visa|no visa)$/i.test(
          seg.trim()
        );

      if (isPureEmploymentType) {
        continue;
      }

      if (looksLikeRole && !looksLikeLocation) {
        roles.push(seg);
      } else if (looksLikeLocation && !looksLikeRole) {
        locations.push(seg);
      } else if (looksLikeRole && looksLikeLocation) {
        // Contains both role and location (or e.g. "Senior Engineer (SF)")
        roles.push(seg);
        locations.push(seg);
      } else if (!matchedWorkMode) {
        // Fallback: second segment is usually Role, third is Location
        if (i === 1 && roles.length === 0) {
          roles.push(seg);
        } else if (i === 2 && locations.length === 0) {
          locations.push(seg);
        } else if (roles.length === 0) {
          roles.push(seg);
        }
      }
    }
  } else {
    // Unstructured comment header fallback
    const firstSentence = headerText.split(/[.\n]/)[0].trim();
    company =
      firstSentence.length > 0 && firstSentence.length <= 60
        ? firstSentence
        : `Post by @${rawComment.author}`;
  }

  // Also scan the full text for work mode / salary / visa / tech stack if missed in header
  const fullLower = plainText.toLowerCase();
  if (workModesSet.size === 0) {
    if (/\b(remote|work from home|fully distributed)\b/i.test(fullLower)) {
      workModesSet.add("Remote");
    }
    if (/\b(hybrid)\b/i.test(fullLower)) {
      workModesSet.add("Hybrid");
    }
    if (/\b(onsite|on-site|in-office)\b/i.test(fullLower)) {
      workModesSet.add("Onsite");
    }
  }

  if (!visaSponsor && !noVisa) {
    if (/\b(no visa|no sponsorship|cannot sponsor)\b/i.test(fullLower)) {
      noVisa = true;
    } else if (/\b(visa sponsorship|sponsor visas|h1b transfer)\b/i.test(fullLower)) {
      visaSponsor = true;
    }
  }

  if (!salaryText) {
    const bodySalaryMatch = plainText.match(
      /[$£€]\s*\d{2,3}(?:[.,]\d{3}|\s*[kK])?(?:\s*[-–—to]+\s*[$£€]?\s*\d{2,3}(?:[.,]\d{3}|\s*[kK])?)?/
    );
    if (bodySalaryMatch) {
      salaryText = bodySalaryMatch[0].trim();
      salaryMaxK = parseSalaryMaxK(salaryText);
    }
  }

  const techStack: string[] = [];
  for (const tech of TECH_KEYWORDS) {
    if (tech.regex.test(plainText)) {
      techStack.push(tech.label);
    }
  }

  return {
    id: rawComment.id,
    parentId: rawComment.parentId,
    author: rawComment.author || "anonymous",
    createdAt: rawComment.createdAt,
    rawHtml,
    headerRaw: headerText,
    bodyHtml: bodyHtml || rawHtml,
    plainText,
    company,
    companyUrl,
    roles: roles.length > 0 ? roles : ["Open Roles"],
    locations:
      locations.length > 0
        ? locations
        : workModesSet.has("Remote")
        ? ["Remote"]
        : [],
    workModes: Array.from(workModesSet),
    visaSponsor,
    noVisa,
    isIntern,
    salaryText,
    salaryMaxK,
    techStack,
    applyUrls: allUrls,
    emails,
    isStructured,
    repliesCount: rawComment.repliesCount || 0,
  };
}


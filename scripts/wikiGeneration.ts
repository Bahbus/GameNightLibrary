import { posix } from "node:path";

export const wikiRepositoryUrl = "https://github.com/Bahbus/BoardGameInventory/wiki";
const sourceRepositoryUrl = "https://github.com/Bahbus/BoardGameInventory";

export interface WikiPageSource {
  source: string;
  target: string;
  label: string;
}

export const wikiPageSources: readonly WikiPageSource[] = [
  { source: "docs/README.md", target: "Home.md", label: "Home" },
  {
    source: "docs/USING_THE_LIBRARY.md",
    target: "Using-the-library.md",
    label: "Using the library"
  },
  {
    source: "docs/INITIAL_COLLECTION_SETUP.md",
    target: "Initial-collection-setup.md",
    label: "Initial collection setup"
  },
  {
    source: "docs/MAINTAINING_THE_LIBRARY.md",
    target: "Maintaining-the-library.md",
    label: "Maintaining the library"
  },
  { source: "docs/DEVELOPMENT.md", target: "Development.md", label: "Development" },
  { source: "docs/ARCHITECTURE.md", target: "Architecture.md", label: "Architecture" },
  { source: "docs/SETUP_SERVICE.md", target: "Setup-service.md", label: "Setup service" },
  {
    source: "docs/REPOSITORY_POLICY.md",
    target: "Repository-policy.md",
    label: "Repository policy"
  },
  { source: "CONTRIBUTING.md", target: "Contributing.md", label: "Contributing" },
  { source: "SECURITY.md", target: "Security.md", label: "Security" },
  { source: "NOTICE.md", target: "Notice.md", label: "Notices and attribution" }
];

const pageBySource = new Map(wikiPageSources.map((page) => [page.source, page]));
const markdownTargetPattern = /(!?\[[^\]]*\]\()([^)]+)(\))/g;

const splitTarget = (rawTarget: string) => {
  const wrapped = rawTarget.startsWith("<") && rawTarget.endsWith(">");
  const target = wrapped ? rawTarget.slice(1, -1) : rawTarget;
  const hashAt = target.indexOf("#");
  return {
    path: hashAt === -1 ? target : target.slice(0, hashAt),
    hash: hashAt === -1 ? "" : target.slice(hashAt)
  };
};

const isExternalTarget = (target: string) => /^(?:[a-z]+:|#)/i.test(target);

export function rewriteWikiLinks(markdown: string, source: string) {
  return markdown.replace(markdownTargetPattern, (match, prefix, rawTarget, suffix) => {
    const target = String(rawTarget).trim();
    if (!target || isExternalTarget(target)) return match;

    const { path, hash } = splitTarget(target);
    const resolved = posix.normalize(posix.join(posix.dirname(source), decodeURIComponent(path)));
    const wikiPage = pageBySource.get(resolved);
    const destination = wikiPage
      ? `${wikiRepositoryUrl}/${wikiPage.target.replace(/\.md$/, "")}${hash}`
      : `${sourceRepositoryUrl}/blob/main/${resolved}${hash}`;
    return `${prefix}${destination}${suffix}`;
  });
}

const sourceNotice = (source: string) =>
  `> This page is generated from [reviewable repository documentation](${sourceRepositoryUrl}/blob/main/${source}). ` +
  "Propose changes there through a pull request; direct Wiki edits are replaced automatically.";

export function createWikiPage(markdown: string, page: WikiPageSource) {
  const content = rewriteWikiLinks(markdown.trim(), page.source);
  const firstLineBreak = content.indexOf("\n");
  if (firstLineBreak === -1) return `${content}\n\n${sourceNotice(page.source)}\n`;
  const body = content.slice(firstLineBreak).replace(/^\n+/, "");
  return `${content.slice(0, firstLineBreak)}\n\n${sourceNotice(page.source)}\n\n${body}\n`;
}

export function createWikiSidebar() {
  const links = wikiPageSources
    .filter((page) => page.target !== "Home.md")
    .map((page) => `- [${page.label}](${wikiRepositoryUrl}/${page.target.replace(/\.md$/, "")})`)
    .join("\n");
  return `## Game Night Library\n\n- [Home](${wikiRepositoryUrl})\n${links}\n`;
}

export async function buildWikiPages(readSource: (source: string) => Promise<string>) {
  const pages = new Map<string, string>();
  for (const page of wikiPageSources) {
    pages.set(page.target, createWikiPage(await readSource(page.source), page));
  }
  pages.set("_Sidebar.md", createWikiSidebar());
  return pages;
}

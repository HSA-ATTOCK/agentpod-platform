"use client";

import {
  Download,
  File,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  Globe,
  MessageSquare,
  Presentation,
  Search,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ButtonLink, buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterTabs } from "@/components/ui/filter-tabs";
import { selectClasses } from "@/components/ui/input";
import { LocalTime } from "@/components/ui/local-time";
import { PageHeader } from "@/components/ui/page-header";
import { routes } from "@/config/routes";
import { formatBytes } from "@/lib/baba/client";
import { cn } from "@/lib/utils";
import type { FileRecord } from "@/types/app-data";

type Kind = FileRecord["kind"];
type Filter = "all" | "document" | "spreadsheet" | "presentation" | "other";
type Sort = "newest" | "oldest" | "name";

const typeMeta: Record<Kind, { label: string; icon: LucideIcon; tint: string }> = {
  document: { label: "Document", icon: FileText, tint: "border-info/20 bg-info/10 text-info" },
  spreadsheet: { label: "Spreadsheet", icon: FileSpreadsheet, tint: "border-success/20 bg-success/10 text-success" },
  presentation: { label: "Presentation", icon: Presentation, tint: "border-warning/20 bg-warning/10 text-warning" },
  website: { label: "Website", icon: Globe, tint: "border-border bg-surface-raised text-subtle" },
  app: { label: "App", icon: Globe, tint: "border-border bg-surface-raised text-subtle" },
  other: { label: "File", icon: File, tint: "border-border bg-surface-raised text-muted" },
};

function chatLink(file: FileRecord) {
  return file.conversationId ? `${routes.ask}?c=${file.conversationId}` : routes.ask;
}

function ProjectCard({ file }: { file: FileRecord }) {
  const meta = typeMeta[file.kind];
  return (
    <Card className="flex h-full flex-col justify-between p-5">
      <div>
        <div className="flex items-start justify-between gap-2">
          <span className={cn("flex size-10 items-center justify-center rounded-control border", meta.tint)}>
            <meta.icon aria-hidden="true" className="size-5" />
          </span>
          <LocalTime iso={file.createdAt} format="date" className="text-[11px] text-subtle" />
        </div>
        <h3 className="mt-3 break-all text-sm font-medium text-foreground">{file.name}</h3>
        <p className="mt-0.5 text-xs text-muted">
          {meta.label} · {formatBytes(file.sizeBytes)}
        </p>
        <p className="mt-3 border-t border-border pt-3 text-xs text-subtle">
          From:{" "}
          {file.conversationId ? (
            <Link href={chatLink(file)} className="text-accent hover:underline">
              {file.conversationTitle ?? "Conversation"}
            </Link>
          ) : (
            <span>a deleted conversation</span>
          )}
        </p>
      </div>
      <div className="mt-5 flex items-center justify-between gap-2 border-t border-border pt-4">
        {file.conversationId ? (
          <Link href={chatLink(file)} className="flex items-center gap-1.5 py-1 text-xs text-muted transition-colors hover:text-foreground">
            <MessageSquare aria-hidden="true" className="size-3.5" />
            Open chat
          </Link>
        ) : (
          <span />
        )}
        {file.downloadUrl ? (
          <a href={file.downloadUrl} download className={buttonClasses({ size: "sm", variant: "secondary" })} aria-label={`Download ${file.name}`}>
            <Download aria-hidden="true" className="size-3.5" />
            Download
          </a>
        ) : (
          <span className="text-[11px] text-subtle">No longer available</span>
        )}
      </div>
    </Card>
  );
}

export function ProjectsView({ files }: { files: FileRecord[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("newest");

  const q = query.trim().toLowerCase();
  const matchesFilter = (f: FileRecord) =>
    filter === "all" || f.kind === filter || (filter === "other" && !["document", "spreadsheet", "presentation"].includes(f.kind));
  const shown = files
    .filter((f) => matchesFilter(f) && (!q || f.name.toLowerCase().includes(q) || f.conversationTitle?.toLowerCase().includes(q)))
    .sort((a, b) =>
      sort === "name" ? a.name.localeCompare(b.name) : sort === "oldest" ? a.createdAt.localeCompare(b.createdAt) : b.createdAt.localeCompare(a.createdAt),
    );

  return (
    <div className="space-y-8">
      <PageHeader title="Projects" description="Every file Baba has made for you, ready to download." />

      <section className="space-y-4" aria-label="Projects">
        <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
          <FilterTabs
            label="Filter by type"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: `All (${files.length})` },
              { value: "document", label: "Documents" },
              { value: "spreadsheet", label: "Spreadsheets" },
              { value: "presentation", label: "Presentations" },
              { value: "other", label: "Other" },
            ]}
          />
          <div className="flex gap-2">
            <div className="relative flex-1 sm:w-64 sm:flex-none">
              <label htmlFor="project-search" className="sr-only">Search files</label>
              <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" />
              <input
                id="project-search"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search files…"
                className="h-10 w-full rounded-control border border-border bg-surface pl-9 pr-3 text-sm text-foreground placeholder:text-subtle focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>
            <label htmlFor="project-sort" className="sr-only">Sort</label>
            <select id="project-sort" value={sort} onChange={(e) => setSort(e.target.value as Sort)} className={cn(selectClasses, "w-32")}>
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="name">Name</option>
            </select>
          </div>
        </div>

        {shown.length === 0 ? (
          <Card>
            <EmptyState
              icon={FolderOpen}
              title={files.length === 0 ? "No files yet" : "No files match"}
              description={
                files.length === 0
                  ? "Ask Baba for a report, spreadsheet or presentation and the file will be saved here."
                  : "Try another type or search."
              }
              action={files.length === 0 ? <ButtonLink href={routes.ask}>Ask Baba</ButtonLink> : undefined}
            />
          </Card>
        ) : (
          <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {shown.map((file) => (
              <li key={file.id}>
                <ProjectCard file={file} />
              </li>
            ))}
          </ul>
        )}

        <p className="text-xs text-subtle">
          Websites and apps will appear here too once the Website Builder and Mobile App Builder agents arrive.
        </p>
      </section>
    </div>
  );
}

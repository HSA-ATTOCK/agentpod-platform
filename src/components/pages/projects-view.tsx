"use client";

import {
  Download,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  Globe,
  MessageSquare,
  Presentation,
  Search,
  Smartphone,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterTabs } from "@/components/ui/filter-tabs";
import { selectClasses } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { routes } from "@/config/routes";
import { sampleProjects, type ProjectType, type SampleProject } from "@/lib/sample-pages";
import { cn } from "@/lib/utils";

type Filter = "all" | ProjectType;
type Sort = "newest" | "oldest" | "name";

const typeMeta: Record<ProjectType, { label: string; icon: LucideIcon; tint: string }> = {
  document: { label: "Document", icon: FileText, tint: "border-info/20 bg-info/10 text-info" },
  spreadsheet: { label: "Spreadsheet", icon: FileSpreadsheet, tint: "border-success/20 bg-success/10 text-success" },
  presentation: { label: "Presentation", icon: Presentation, tint: "border-warning/20 bg-warning/10 text-warning" },
  website: { label: "Website", icon: Globe, tint: "border-border bg-surface-raised text-subtle" },
  app: { label: "App", icon: Smartphone, tint: "border-border bg-surface-raised text-subtle" },
};

const dateFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** Simple shapes standing in for a website / app screenshot. */
function PreviewShapes({ type }: { type: ProjectType }) {
  if (type === "app") {
    return (
      <div aria-hidden="true" className="mt-3 flex h-20 items-center justify-center rounded-control border border-border bg-surface-raised">
        <div className="flex h-16 w-11 flex-col justify-between rounded-md border border-border-strong p-1">
          <div className="mx-auto h-0.5 w-4 rounded bg-border-strong" />
          <div className="space-y-1">
            <div className="h-1 rounded bg-border-strong" />
            <div className="h-1 w-3/4 rounded bg-border" />
          </div>
          <div className="mx-auto size-2 rounded-full bg-accent/30" />
        </div>
      </div>
    );
  }
  return (
    <div aria-hidden="true" className="mt-3 flex h-20 flex-col justify-between rounded-control border border-border bg-surface-raised p-2">
      <div className="flex items-center gap-1 border-b border-border pb-1">
        <span className="size-1.5 rounded-full bg-border-strong" />
        <span className="size-1.5 rounded-full bg-border-strong" />
        <span className="size-1.5 rounded-full bg-border-strong" />
      </div>
      <div className="space-y-1">
        <div className="h-2 w-2/3 rounded bg-border-strong" />
        <div className="h-1.5 w-1/2 rounded bg-border" />
      </div>
      <div className="flex gap-1.5">
        <div className="h-3 w-8 rounded bg-accent/20" />
        <div className="h-3 w-8 rounded bg-border" />
      </div>
    </div>
  );
}

function ProjectCard({ project }: { project: SampleProject }) {
  const meta = typeMeta[project.type];
  const buildable = project.type === "website" || project.type === "app";
  return (
    <Card className="flex h-full flex-col justify-between p-5">
      <div>
        <div className="flex items-start justify-between gap-2">
          <span className={cn("flex size-10 items-center justify-center rounded-control border", meta.tint)}>
            <meta.icon aria-hidden="true" className="size-5" />
          </span>
          {project.comingSoon ? (
            <Badge tone="neutral">Coming soon</Badge>
          ) : (
            <span className="text-[11px] text-subtle">{dateFormat.format(new Date(project.createdAt))}</span>
          )}
        </div>
        <h3 className="mt-3 break-all text-sm font-medium text-foreground">{project.name}</h3>
        <p className="mt-0.5 text-xs text-muted">
          {meta.label}
          {project.size && ` · ${project.size}`}
        </p>
        {buildable && <PreviewShapes type={project.type} />}
        <p className="mt-3 border-t border-border pt-3 text-xs text-subtle">
          From:{" "}
          <Link href={routes.ask} className="text-accent hover:underline">
            {project.conversation}
          </Link>
        </p>
      </div>
      <div className="mt-5 flex items-center justify-between gap-2 border-t border-border pt-4">
        <Link href={routes.ask} className="flex items-center gap-1.5 py-1 text-xs text-muted transition-colors hover:text-foreground">
          <MessageSquare aria-hidden="true" className="size-3.5" />
          Open chat
        </Link>
        {buildable ? (
          <Button size="sm" variant="secondary" disabled title="Website and app building is coming soon">
            Preview
          </Button>
        ) : (
          <Button size="sm" variant="secondary" disabled title="Sample file — real files download from Ask Baba">
            <Download aria-hidden="true" className="size-3.5" />
            Download
          </Button>
        )}
      </div>
    </Card>
  );
}

export function ProjectsView() {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("newest");

  const q = query.trim().toLowerCase();
  const shown = sampleProjects
    .filter((p) => (filter === "all" || p.type === filter) && (!q || p.name.toLowerCase().includes(q)))
    .sort((a, b) =>
      sort === "name" ? a.name.localeCompare(b.name) : sort === "oldest" ? a.createdAt.localeCompare(b.createdAt) : b.createdAt.localeCompare(a.createdAt),
    );

  return (
    <div className="space-y-8">
      <PageHeader
        title="Projects"
        description="Everything Baba has made for you: documents, spreadsheets, websites and apps."
        sample
      />
      <p className="-mt-4 text-xs text-subtle">
        Files Baba creates can be downloaded from their conversation in Ask Baba. Saving them here needs a database, which is coming later.
      </p>

      <section className="space-y-4" aria-label="Projects">
        <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
          <FilterTabs
            label="Filter by type"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: "All" },
              { value: "document", label: "Documents" },
              { value: "spreadsheet", label: "Spreadsheets" },
              { value: "presentation", label: "Presentations" },
              { value: "website", label: "Websites" },
              { value: "app", label: "Apps" },
            ]}
          />
          <div className="flex gap-2">
            <div className="relative flex-1 sm:w-64 sm:flex-none">
              <label htmlFor="project-search" className="sr-only">Search projects</label>
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
              title="Nothing here yet"
              description="Files Baba creates in Ask Baba will appear here."
              action={<ButtonLink href={routes.ask}>Ask Baba</ButtonLink>}
            />
          </Card>
        ) : (
          <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {shown.map((project) => (
              <li key={project.id}>
                <ProjectCard project={project} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

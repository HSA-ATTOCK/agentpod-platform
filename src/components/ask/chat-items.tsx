"use client";

import { ChevronDown, CircleAlert, FileText } from "lucide-react";
import { useId, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { fileKindMeta } from "@/lib/chat-meta";
import { cn } from "@/lib/utils";
import type { AnswerBlock, ChatItem, ChatSource } from "@/types/chat";
import { StepStatusIcon } from "./step-status-icon";

type ItemOf<T extends ChatItem["type"]> = Extract<ChatItem, { type: T }>;

/** The user's message, on the right. */
export function UserMessage({ item }: { item: ItemOf<"user"> }) {
  return (
    <div className="flex w-full justify-end">
      <div className="flex max-w-[85%] flex-col gap-2 rounded-card border border-border bg-surface-raised p-4 sm:max-w-2xl">
        {item.attachments.length > 0 && (
          <ul className="flex flex-wrap gap-1.5" aria-label="Attached files">
            {item.attachments.map((file) => (
              <li
                key={file.id}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1 text-xs text-foreground"
              >
                <FileText aria-hidden="true" className="size-3.5 text-accent" />
                {file.name}
              </li>
            ))}
          </ul>
        )}
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{item.text}</p>
      </div>
    </div>
  );
}

/** "Working on it" block with live steps. */
export function ProgressBlock({ item }: { item: ItemOf<"progress"> }) {
  const [showDetails, setShowDetails] = useState(false);
  const detailsId = useId();
  const done = item.steps.filter((s) => s.status === "done").length;

  return (
    <div className="rounded-card border border-border bg-surface p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground">{item.title}</span>
          <Badge tone="accent" className="text-[11px]">
            {done} of {item.steps.length} done
          </Badge>
        </div>
        <button
          type="button"
          onClick={() => setShowDetails((v) => !v)}
          aria-expanded={showDetails}
          aria-controls={detailsId}
          className="flex items-center gap-1 rounded-md px-1 py-1 text-xs text-muted transition-colors hover:text-foreground"
        >
          {showDetails ? "Hide details" : "Show details"}
          <ChevronDown aria-hidden="true" className={cn("size-4 transition-transform", showDetails && "rotate-180")} />
        </button>
      </div>
      <ol id={detailsId} className="space-y-2.5">
        {item.steps.map((step) => (
          <li key={step.id}>
            <div className="flex items-start gap-2.5">
              <span className="mt-0.5 flex">
                <StepStatusIcon status={step.status} />
              </span>
              <span className={cn("text-sm", step.status === "pending" ? "text-muted" : "text-foreground")}>
                {step.label}
                {step.agent && (
                  <span className="ml-2 inline-flex rounded-full border border-border bg-surface-raised px-2 py-0.5 align-middle text-[11px] text-subtle">
                    {step.agent}
                  </span>
                )}
              </span>
            </div>
            {showDetails && step.detail && <p className="mt-1 pl-7 text-xs text-muted">{step.detail}</p>}
          </li>
        ))}
      </ol>
    </div>
  );
}

function SourceCard({ source }: { source: ChatSource }) {
  return (
    <li className="flex max-w-52 min-w-0 items-center gap-2.5 rounded-xl border border-border bg-surface px-3 py-2">
      <span
        aria-hidden="true"
        className="flex size-6 shrink-0 items-center justify-center rounded-md bg-accent/15 text-xs font-semibold text-accent"
      >
        {source.title[0]}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-xs font-medium text-foreground">{source.title}</span>
        <span className="block truncate text-[11px] text-subtle">{source.domain}</span>
      </span>
    </li>
  );
}

/** Row of web sources Baba used. */
export function SourcesRow({ item }: { item: ItemOf<"sources"> }) {
  const more = item.totalCount - item.sources.length;
  return (
    <ul className="flex flex-wrap items-center gap-2" aria-label={`${item.totalCount} sources`}>
      {item.sources.map((source) => (
        <SourceCard key={source.id} source={source} />
      ))}
      {more > 0 && (
        <li className="rounded-xl border border-border bg-surface-raised px-3 py-2 text-xs text-muted">+{more} more</li>
      )}
    </ul>
  );
}

function AnswerBlockView({ block }: { block: AnswerBlock }) {
  switch (block.type) {
    case "paragraph":
      return <p className="text-sm leading-relaxed text-foreground">{block.text}</p>;
    case "heading":
      return <h3 className="pt-1 text-base font-semibold text-foreground">{block.text}</h3>;
    case "list":
      return (
        <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-muted marker:text-subtle">
          {block.items.map((li, index) => (
            <li key={index}>
              {li.lead && <strong className="font-semibold text-foreground">{li.lead} </strong>}
              {li.text}
            </li>
          ))}
        </ul>
      );
    case "table":
      return (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-subtle">
                {block.columns.map((column) => (
                  <th key={column} scope="col" className="whitespace-nowrap px-3 py-2.5 font-medium">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {block.rows.map((row, rowIndex) => (
                <tr key={rowIndex} className={rowIndex === block.highlightRowIndex ? "bg-accent/10" : undefined}>
                  {row.map((cell, cellIndex) => (
                    <td
                      key={cellIndex}
                      className={cn(
                        "px-3 py-2.5 text-foreground",
                        cellIndex === 0 && "whitespace-nowrap font-medium",
                        cellIndex === 0 && rowIndex === block.highlightRowIndex && "text-accent",
                      )}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
  }
}

/** Baba's written answer: paragraphs, headings, lists and tables. */
export function AnswerView({ item }: { item: ItemOf<"answer"> }) {
  return (
    <div className="space-y-3">
      {item.blocks.map((block, index) => (
        <AnswerBlockView key={index} block={block} />
      ))}
    </div>
  );
}

/** A file Baba created. Downloads aren't possible until Baba is connected. */
export function FileCard({ item }: { item: ItemOf<"file"> }) {
  const meta = fileKindMeta[item.file.kind];
  return (
    <div className="rounded-card border border-border bg-surface-raised p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent">
            <meta.icon aria-hidden="true" className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{item.file.name}</p>
            <p className="text-xs text-muted">
              {meta.label} · {item.file.sizeLabel}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" disabled className="h-9 rounded-control border border-border bg-surface px-3 text-xs font-medium text-foreground disabled:cursor-not-allowed disabled:opacity-50">
            Preview
          </button>
          <button type="button" disabled className="h-9 rounded-control bg-accent px-3 text-xs font-semibold text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50">
            Download
          </button>
        </div>
      </div>
      <p className="mt-2 text-[11px] text-subtle">Sample file. Downloads will work once Baba is connected.</p>
    </div>
  );
}

/** Baba reporting a problem, with an optional fix-it button. */
export function ErrorMessage({ item }: { item: ItemOf<"error"> }) {
  return (
    <div role="alert" className="relative overflow-hidden rounded-card border border-danger/30 bg-danger/10 p-4">
      <div aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-danger" />
      <div className="flex flex-wrap items-center justify-between gap-3 pl-2">
        <div className="flex min-w-0 items-start gap-2.5">
          <CircleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-danger" />
          <p className="text-sm text-foreground">{item.text}</p>
        </div>
        {item.action && (
          <ButtonLink href={item.action.href} variant="secondary" size="sm">
            {item.action.label}
          </ButtonLink>
        )}
      </div>
    </div>
  );
}

/** A plain text reply from Baba. */
export function TextReply({ item }: { item: ItemOf<"text"> }) {
  return <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{item.text}</p>;
}

/** "Baba is thinking…" with three bouncing dots. */
export function ThinkingIndicator() {
  return (
    <div role="status" className="flex items-center gap-1.5 py-1.5 text-sm text-muted">
      <span>Baba is thinking</span>
      <span aria-hidden="true" className="inline-flex items-center gap-1">
        <span className="size-1.5 animate-bounce rounded-full bg-accent" />
        <span className="size-1.5 animate-bounce rounded-full bg-accent [animation-delay:150ms]" />
        <span className="size-1.5 animate-bounce rounded-full bg-accent [animation-delay:300ms]" />
      </span>
    </div>
  );
}

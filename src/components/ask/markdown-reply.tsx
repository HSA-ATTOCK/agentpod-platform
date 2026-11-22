import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

/** Styles for each Markdown element, matching the app's design tokens. */
const components: Components = {
  p: ({ children }) => <p className="text-sm leading-relaxed text-foreground">{children}</p>,
  h1: ({ children }) => <h3 className="pt-1 text-lg font-semibold text-foreground">{children}</h3>,
  h2: ({ children }) => <h3 className="pt-1 text-base font-semibold text-foreground">{children}</h3>,
  h3: ({ children }) => <h4 className="pt-1 text-sm font-semibold text-foreground">{children}</h4>,
  ul: ({ children }) => <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-muted marker:text-subtle">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-muted marker:text-subtle">{children}</ol>,
  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-accent underline underline-offset-2 hover:text-accent-hover">
      {children}
    </a>
  ),
  blockquote: ({ children }) => <blockquote className="border-l-2 border-border-strong pl-3 text-sm text-muted">{children}</blockquote>,
  code: ({ children }) => <code className="rounded bg-surface-raised px-1 py-0.5 font-mono text-[13px] text-foreground">{children}</code>,
  pre: ({ children }) => (
    <pre className="overflow-x-auto rounded-xl border border-border bg-surface p-3 font-mono text-xs text-foreground [&_code]:bg-transparent [&_code]:p-0">
      {children}
    </pre>
  ),
  hr: () => <hr className="border-border" />,
  table: ({ children }) => (
    <div className="overflow-x-auto rounded-xl border border-border bg-surface">
      <table className="w-full border-collapse text-left text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="border-b border-border text-xs text-subtle">{children}</thead>,
  tbody: ({ children }) => <tbody className="divide-y divide-border/60">{children}</tbody>,
  th: ({ children }) => <th scope="col" className="px-3 py-2.5 font-medium">{children}</th>,
  td: ({ children }) => <td className="px-3 py-2.5 text-foreground">{children}</td>,
};

/** Renders Baba's Markdown reply safely (raw HTML in the text is not rendered). */
export function MarkdownReply({ text }: { text: string }) {
  return (
    <div className="min-w-0 space-y-3">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {text}
      </ReactMarkdown>
    </div>
  );
}

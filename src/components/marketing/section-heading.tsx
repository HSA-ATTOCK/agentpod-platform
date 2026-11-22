/** Eyebrow + title + description used at the top of landing page sections. */
export function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="mx-auto mb-12 max-w-3xl text-center sm:mb-16">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-accent">{eyebrow}</p>
      <h2 className="text-3xl font-bold text-foreground sm:text-4xl">{title}</h2>
      {description && <p className="mt-4 text-base text-muted">{description}</p>}
    </div>
  );
}

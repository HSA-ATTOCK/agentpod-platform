/** Title + subtitle at the top of each auth form. */
export function AuthHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-8">
      <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
      <p className="mt-1.5 text-sm text-muted">{subtitle}</p>
    </div>
  );
}

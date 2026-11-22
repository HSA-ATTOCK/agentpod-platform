/** Horizontal line with a label in the middle, e.g. "or continue with email". */
export function AuthDivider({ label }: { label: string }) {
  return (
    <div className="relative my-6">
      <div aria-hidden="true" className="absolute inset-0 flex items-center">
        <div className="w-full border-t border-border" />
      </div>
      <div className="relative flex justify-center text-xs uppercase">
        <span className="bg-surface px-3 text-subtle">{label}</span>
      </div>
    </div>
  );
}

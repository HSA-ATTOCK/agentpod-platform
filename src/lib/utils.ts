/**
 * Join class names, skipping falsy values.
 * Example: cn("px-4", isActive && "bg-accent", className)
 */
export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

/** For case-insensitive exact matches with ILIKE: escapes the % and _ wildcards (and the escape character). */
export function likeExact(value: string) {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

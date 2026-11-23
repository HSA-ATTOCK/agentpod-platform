"use client";

import { ErrorScreen } from "@/components/ui/error-screen";

/** Shown when this part of the app fails to load. */
export default function Error({ error, retry }: { error: unknown; retry: () => void }) {
  return <ErrorScreen error={error} retry={retry} />;
}

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { signInWithGoogle, type AuthResult } from "@/lib/auth/client";
import { safeNext } from "@/lib/auth/safe-next";

function GoogleIcon() {
  return (
    <svg aria-hidden="true" className="size-4" viewBox="0 0 24 24">
      <path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.4 1 3.5 3.6 1.6 7.4l3.7 2.9C6.2 7.3 8.9 5 12 5z" />
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.7-.2-2.3H12v4.6h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.9z" />
      <path fill="#FBBC05" d="M5.3 14.7c-.2-.7-.4-1.6-.4-2.7s.1-1.9.4-2.7L1.6 6.4C.6 8.3 0 10.1 0 12s.6 3.7 1.6 5.6l3.7-2.9z" />
      <path fill="#34A853" d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3.1 0-5.8-2.3-6.7-5.3L1.6 15.9C3.5 19.7 7.4 23 12 23z" />
    </svg>
  );
}

/** "Continue with Google". Reports errors to the parent form so it can show a message. */
export function GoogleButton({ onResult }: { onResult: (result: AuthResult) => void }) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    const result = await signInWithGoogle(safeNext(new URLSearchParams(window.location.search).get("next")));
    // On success the browser is already on its way to Google
    if (!result.ok) {
      setLoading(false);
      onResult(result);
    }
  }

  return (
    <Button
      variant="secondary"
      fullWidth
      loading={loading}
      loadingText="Connecting to Google…"
      onClick={handleClick}
      className="h-11 gap-3"
    >
      <GoogleIcon />
      Continue with Google
    </Button>
  );
}

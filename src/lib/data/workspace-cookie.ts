/** Cookie that remembers which workspace the person is working in (validated on the server). */
export const WORKSPACE_COOKIE = "baba_ws";

/** Switches workspace in the browser and reloads so every page shows the new one. */
export function switchWorkspace(workspaceId: string, goTo = "/dashboard") {
  document.cookie = `${WORKSPACE_COOKIE}=${encodeURIComponent(workspaceId)}; path=/; max-age=31536000; samesite=lax`;
  window.location.assign(goTo);
}

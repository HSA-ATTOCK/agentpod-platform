/**
 * Every route in the app, in one place.
 * Always link with these constants instead of typing paths by hand.
 */
export const routes = {
  home: "/",
  terms: "/terms",
  privacy: "/privacy",

  // Auth
  signIn: "/sign-in",
  signUp: "/sign-up",
  forgotPassword: "/forgot-password",
  verifyEmail: "/verify-email",
  resetPassword: "/reset-password",
  twoFactor: "/two-factor",
  authCallback: "/auth/callback",
  signOut: "/auth/sign-out",

  // App (authenticated)
  ask: "/ask",
  dashboard: "/dashboard",
  agents: "/agents",
  workflows: "/workflows",
  projects: "/projects",
  integrations: "/integrations",
  activity: "/activity",
  settings: "/settings",
  profile: "/profile",
} as const;

export type AppRoute = (typeof routes)[keyof typeof routes];

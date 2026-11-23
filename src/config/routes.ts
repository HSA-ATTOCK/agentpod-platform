/**
 * Every route in the app, in one place.
 * Always link with these constants instead of typing paths by hand.
 */
export const routes = {
  home: "/",
  terms: "/terms",
  privacy: "/privacy",

  // Public website
  features: "/features",
  aiAgents: "/ai-agents",
  /** Public integrations overview. Not `/integrations`, which is the signed-in app page. */
  connections: "/connections",
  useCases: "/use-cases",
  pricing: "/pricing",
  about: "/about",
  contact: "/contact",

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
  memory: "/memory",
  sites: "/sites",
  usage: "/usage",
  pending: "/pending",

  // Platform administration (master administrators only)
  admin: "/admin",
} as const;

export type AppRoute = (typeof routes)[keyof typeof routes];

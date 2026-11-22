import {
  Activity,
  Bot,
  GitBranch,
  LayoutDashboard,
  PlugZap,
  Settings,
  User,
  type LucideIcon,
} from "lucide-react";
import { routes, type AppRoute } from "./routes";

export type NavItem = {
  label: string;
  /** Shorter label for the mobile tab bar. */
  shortLabel?: string;
  href: AppRoute;
  icon: LucideIcon;
};

/** Main sidebar / mobile tab bar navigation for the authenticated app. */
export const appNavigation: NavItem[] = [
  { label: "Dashboard", shortLabel: "Home", href: routes.dashboard, icon: LayoutDashboard },
  { label: "AI Agents", shortLabel: "Agents", href: routes.agents, icon: Bot },
  { label: "Workflows", href: routes.workflows, icon: GitBranch },
  { label: "Integrations", shortLabel: "Apps", href: routes.integrations, icon: PlugZap },
  { label: "Activity", href: routes.activity, icon: Activity },
];

/** Secondary items shown at the bottom of the sidebar and in the mobile user menu. */
export const appSecondaryNavigation: NavItem[] = [
  { label: "Settings", href: routes.settings, icon: Settings },
  { label: "Profile", href: routes.profile, icon: User },
];

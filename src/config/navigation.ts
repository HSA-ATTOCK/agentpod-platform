import {
  Activity,
  Bot,
  Brain,
  FolderOpen,
  GitBranch,
  Globe,
  LayoutDashboard,
  PlugZap,
  Settings,
  Sparkles,
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
  /** Show in the mobile bottom tab bar (max 5 items). */
  inTabBar?: boolean;
};

/** Main sidebar navigation for the authenticated app. Items with inTabBar also appear in the mobile tab bar. */
export const appNavigation: NavItem[] = [
  { label: "Ask Baba", href: routes.ask, icon: Sparkles, inTabBar: true },
  { label: "Dashboard", shortLabel: "Home", href: routes.dashboard, icon: LayoutDashboard, inTabBar: true },
  { label: "AI Agents", shortLabel: "Agents", href: routes.agents, icon: Bot, inTabBar: true },
  { label: "Workflows", href: routes.workflows, icon: GitBranch, inTabBar: true },
  { label: "Projects", href: routes.projects, icon: FolderOpen },
  { label: "Websites", href: routes.sites, icon: Globe },
  { label: "Memory", href: routes.memory, icon: Brain },
  { label: "Integrations", shortLabel: "Apps", href: routes.integrations, icon: PlugZap },
  { label: "Activity", href: routes.activity, icon: Activity, inTabBar: true },
];

/** Secondary items shown at the bottom of the sidebar and in the mobile user menu. */
export const appSecondaryNavigation: NavItem[] = [
  { label: "Settings", href: routes.settings, icon: Settings },
  { label: "Profile", href: routes.profile, icon: User },
];

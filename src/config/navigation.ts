import {
  Activity,
  Bot,
  LayoutDashboard,
  Plug,
  Settings,
  User,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import { routes, type AppRoute } from "./routes";

export type NavItem = {
  label: string;
  href: AppRoute;
  icon: LucideIcon;
};

/** Main sidebar / mobile navigation for the authenticated app. */
export const appNavigation: NavItem[] = [
  { label: "Dashboard", href: routes.dashboard, icon: LayoutDashboard },
  { label: "AI Agents", href: routes.agents, icon: Bot },
  { label: "Workflows", href: routes.workflows, icon: Workflow },
  { label: "Integrations", href: routes.integrations, icon: Plug },
  { label: "Activity", href: routes.activity, icon: Activity },
];

/** Secondary items shown at the bottom of the sidebar. */
export const appSecondaryNavigation: NavItem[] = [
  { label: "Settings", href: routes.settings, icon: Settings },
  { label: "Profile", href: routes.profile, icon: User },
];

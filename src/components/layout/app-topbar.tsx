import { MessageSquare } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { routes } from "@/config/routes";
import { GlobalSearch } from "./global-search";
import { NotificationsMenu } from "./notifications-menu";

/** Top bar above the content on large screens. */
export function AppTopbar({ workspaceId }: { workspaceId: string }) {
  return (
    <header className="sticky top-0 z-30 hidden h-16 items-center justify-between gap-6 border-b border-border bg-background/80 px-8 backdrop-blur-md lg:flex">
      <GlobalSearch workspaceId={workspaceId} />
      <div className="flex items-center gap-4">
        <NotificationsMenu workspaceId={workspaceId} />
        <ButtonLink href={routes.ask}>
          <MessageSquare aria-hidden="true" className="size-4" />
          Ask Baba
        </ButtonLink>
      </div>
    </header>
  );
}

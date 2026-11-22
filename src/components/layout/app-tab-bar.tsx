import { TabBarNav } from "./nav-link";

/** Fixed bottom tab bar for phones and tablets. */
export function AppTabBar() {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg lg:hidden"
    >
      <div className="mx-auto flex max-w-lg items-center justify-around">
        <TabBarNav />
      </div>
    </nav>
  );
}

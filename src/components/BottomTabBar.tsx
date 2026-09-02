import { CalendarCheck, ChartLine, ListChecks, Settings } from "lucide-react";
import type { ComponentType } from "react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

type Tab = {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  // Path prefixes that light this tab up. `to` can point deeper than the
  // section it represents ("Registrar" opens /rounds/new, but /rounds/:id and
  // the /rounds history belong to it too).
  match: string[];
};

const TABS: Tab[] = [
  { to: "/views", label: "Inicio", icon: ChartLine, match: ["/views"] },
  { to: "/rounds/new", label: "Registrar", icon: CalendarCheck, match: ["/rounds"] },
  { to: "/routines", label: "Rutinas", icon: ListChecks, match: ["/routines"] },
  { to: "/settings", label: "Ajustes", icon: Settings, match: ["/settings"] },
];

function isActive(pathname: string, tab: Tab) {
  return tab.match.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function BottomTabBar() {
  const { pathname } = useLocation();

  return (
    <nav
      aria-label="Secciones"
      className="fixed inset-x-0 bottom-0 z-50 border-t bg-background pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto flex max-w-lg">
        {TABS.map((tab) => {
          const active = isActive(pathname, tab);
          return (
            <li key={tab.to} className="flex-1">
              <Link
                to={tab.to}
                aria-current={active ? "page" : undefined}
                // Deliberately tall and full-width: this bar is used with a
                // thumb, mid-routine, so every target is the whole cell.
                className={cn(
                  "flex h-16 flex-col items-center justify-center gap-1 text-xs transition-colors",
                  active ? "text-foreground" : "text-muted-foreground",
                )}
              >
                <tab.icon className={cn("size-5", active && "stroke-[2.5]")} />
                <span className={cn(active && "font-medium")}>{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

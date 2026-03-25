import { cn } from "@/lib/utils";
import { Home, Megaphone, Calendar, BookOpen, Bell, MessageCircle } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useBadgeCounts } from "@/hooks/useBadgeCounts";

const navItems = [
  { icon: Home, label: "Home", path: "/dashboard", badgeKey: null },
  { icon: Megaphone, label: "Announcements", path: "/announcements", badgeKey: "announcements" },
  { icon: MessageCircle, label: "Messages", path: "/messages", badgeKey: "messages" },
  { icon: BookOpen, label: "Assignments", path: "/assignments", badgeKey: "assignments" },
  { icon: Calendar, label: "Timetable", path: "/timetable", badgeKey: "timetable" },
  { icon: Bell, label: "Alerts", path: "/notifications", badgeKey: "notifications" },
] as const;

function Badge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold leading-4 flex items-center justify-center">
      {count > 99 ? "99+" : count}
    </span>
  );
}

export function BottomNav() {
  const location = useLocation();
  const counts = useBadgeCounts();

  const badgeFor = (key: string | null): number => {
    if (!key) return 0;
    return (counts as Record<string, number>)[key] ?? 0;
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border safe-bottom">
      <div className="flex items-center justify-around px-2 py-2">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;
          const count = badgeFor(item.badgeKey);

          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all duration-200 min-w-[64px]",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              )}
            >
              <div className="relative">
                <Icon
                  className={cn(
                    "w-5 h-5 transition-transform",
                    isActive && "scale-110"
                  )}
                />
                <Badge count={count} />
              </div>
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

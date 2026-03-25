import { cn } from "@/lib/utils";
import { AnnouncementLevel } from "@/types";
import { Building2, Users, GraduationCap } from "lucide-react";

interface LevelBadgeProps {
  level: AnnouncementLevel;
  className?: string;
}

const levelConfig = {
  school: {
    label: "School-Level",
    icon: Building2,
    className: "bg-primary/10 text-primary border border-primary/20",
  },
  department: {
    label: "Department",
    icon: Users,
    className: "bg-secondary text-secondary-foreground border border-border",
  },
  group: {
    label: "Group",
    icon: GraduationCap,
    className: "bg-accent text-accent-foreground border border-border",
  },
};

export function LevelBadge({ level, className }: LevelBadgeProps) {
  const config = levelConfig[level];
  const Icon = config.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium",
        config.className,
        className
      )}
    >
      <Icon className="w-3 h-3" />
      {config.label}
    </span>
  );
}

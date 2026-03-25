import { cn } from "@/lib/utils";
import { AnnouncementPriority } from "@/types";

interface PriorityBadgeProps {
  priority: AnnouncementPriority;
  className?: string;
}

const priorityConfig = {
  high: {
    label: "High Priority",
    className: "bg-priority-high text-primary-foreground",
  },
  medium: {
    label: "Medium",
    className: "bg-priority-medium text-primary-foreground",
  },
  low: {
    label: "Low",
    className: "bg-priority-low text-secondary-foreground",
  },
};

export function PriorityBadge({ priority, className }: PriorityBadgeProps) {
  const normalizedPriority = (priority?.toLowerCase() || "low") as AnnouncementPriority;
  const config = priorityConfig[normalizedPriority] || priorityConfig.low;

  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  );
}

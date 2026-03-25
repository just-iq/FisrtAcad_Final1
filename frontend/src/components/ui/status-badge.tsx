import { cn } from "@/lib/utils";
import { AssignmentStatus } from "@/types";

interface StatusBadgeProps {
  status: AssignmentStatus;
  className?: string;
}

const statusConfig = {
  pending: {
    label: "Pending",
    className: "bg-status-pending/20 text-status-pending border border-status-pending/30",
  },
  submitted: {
    label: "Submitted",
    className: "bg-status-success/20 text-status-success border border-status-success/30",
  },
  graded: {
    label: "Graded",
    className: "bg-primary/20 text-primary border border-primary/30",
  },
  overdue: {
    label: "Overdue",
    className: "bg-destructive/20 text-destructive border border-destructive/30",
  },
  missed: {
    label: "Missed",
    className: "bg-destructive/20 text-destructive border border-destructive/30",
  },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status];

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

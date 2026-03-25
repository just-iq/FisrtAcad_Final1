import { Assignment } from "@/types";
import { StatusBadge } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";
import { format, differenceInDays } from "date-fns";
import { Calendar, RefreshCw } from "lucide-react";

interface AssignmentCardProps {
  assignment: Assignment;
  className?: string;
}

export function AssignmentCard({ assignment, className }: AssignmentCardProps) {
  const daysUntilDue = differenceInDays(assignment.dueDate, new Date());
  const isUrgent = daysUntilDue <= 2 && daysUntilDue >= 0;

  return (
    <article
      className={cn(
        "bg-card rounded-xl border border-border p-4 shadow-soft transition-all",
        isUrgent && assignment.status === "pending" && "border-l-4 border-l-status-warning",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-md">
          {assignment.courseCode}
        </span>
        <StatusBadge status={assignment.status} />
      </div>

      <h3 className="font-serif font-semibold text-foreground text-sm mb-2 leading-tight">
        {assignment.title}
      </h3>

      <p className="text-xs text-muted-foreground mb-3">
        {assignment.courseName}
      </p>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Calendar className="w-3.5 h-3.5" />
          <span>Due: {format(assignment.dueDate, "MMM d, yyyy")}</span>
        </div>

        {assignment.allowResubmission && (
          <div className="flex items-center gap-1 text-xs text-status-success">
            <RefreshCw className="w-3 h-3" />
            <span>Resubmit</span>
          </div>
        )}
      </div>
    </article>
  );
}

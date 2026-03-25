import { TimetableEntry } from "@/types";
import { cn } from "@/lib/utils";
import { Clock, MapPin, User } from "lucide-react";

interface TimetableCardProps {
  entry: TimetableEntry;
  isNow?: boolean;
  className?: string;
}

export function TimetableCard({ entry, isNow, className }: TimetableCardProps) {
  return (
    <article
      className={cn(
        "bg-card rounded-xl border border-border p-4 shadow-soft transition-all",
        isNow && "ring-2 ring-primary border-primary bg-primary/5",
        className
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
          <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-md truncate max-w-[80px]">
            {entry.courseCode}
          </span>
          {isNow && (
            <span className="text-xs font-medium text-status-success bg-status-success/10 px-2 py-0.5 rounded-md animate-pulse-soft whitespace-nowrap">
              Ongoing
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0">
          <Clock className="w-3 h-3" />
          <span className="whitespace-nowrap">
            {entry.startTime} - {entry.endTime}
          </span>
        </div>
      </div>

      <h3 className="font-serif font-semibold text-foreground text-sm mb-3 leading-tight line-clamp-2">
        {entry.courseName}
      </h3>

      <div className="flex flex-col gap-1.5 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5 min-w-0">
          <User className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="truncate">{entry.lecturer}</span>
        </div>
        <div className="flex items-center gap-1.5 min-w-0">
          <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="truncate">{entry.room}</span>
        </div>
      </div>
    </article>
  );
}

import { Announcement } from "@/types";
import { PriorityBadge } from "@/components/ui/priority-badge";
import { LevelBadge } from "@/components/ui/level-badge";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { Sparkles } from "lucide-react";

interface AnnouncementCardProps {
  announcement: Announcement;
  className?: string;
}

export function AnnouncementCard({ announcement, className }: AnnouncementCardProps) {
  const roleLabels = {
    admin: "Admin",
    lecturer: "Lecturer",
    student_executive: "Executive",
    course_rep: "Course Rep",
    student: "Student",
  };

  return (
    <article
      className={cn(
        "bg-card rounded-xl border border-border p-4 shadow-soft transition-all duration-200 hover:shadow-card animate-fade-in",
        announcement.priority === "high" && "border-l-4 border-l-priority-high",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex flex-wrap gap-2">
          <LevelBadge level={announcement.level} />
          <PriorityBadge priority={announcement.priority} />
        </div>
      </div>

      <h3 className="font-serif font-semibold text-foreground text-base mb-2 leading-tight">
        {announcement.title}
      </h3>

      <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
        {announcement.content}
      </p>

      {/* AI Summary Placeholder */}
      {announcement.summary && (
        <div className="bg-accent/50 rounded-lg p-3 mb-3 border border-border">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5">
            <Sparkles className="w-3 h-3" />
            <span className="font-medium">AI Summary</span>
          </div>
          <p className="text-xs text-foreground/80 leading-relaxed">
            {announcement.summary}
          </p>
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <span className="font-medium text-foreground/80">{announcement.source}</span>
          <span>•</span>
          <span>{roleLabels[announcement.sourceRole]}</span>
        </div>
        <time dateTime={announcement.timestamp.toISOString()}>
          {formatDistanceToNow(announcement.timestamp, { addSuffix: true })}
        </time>
      </div>
    </article>
  );
}

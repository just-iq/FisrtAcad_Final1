import { MobileLayout } from "@/components/layout/MobileLayout";
import { AnnouncementCard } from "@/components/cards/AnnouncementCard";
import { cn } from "@/lib/utils";
import { TimetableCard } from "@/components/cards/TimetableCard";
import { QuickStatCard } from "@/components/cards/QuickStatCard";
import { BookOpen, FileText, Calendar, Megaphone, Building, Clock } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { PriorityBadge } from "@/components/ui/priority-badge";
import { LevelBadge } from "@/components/ui/level-badge";
import { formatDistanceToNow } from "date-fns";
import { Sparkles } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { getAuthUser } from "@/lib/auth";
import { useEffect } from "react";
import { getSocket } from "@/lib/socket";

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  return "Good Evening";
}

export default function Dashboard() {
  const user = getAuthUser();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Refresh when socket events arrive
  useEffect(() => {
    const s = getSocket();
    const onAnnouncement = () => queryClient.invalidateQueries({ queryKey: ["announcements", "feed"] });
    const onTimetable = () => queryClient.invalidateQueries({ queryKey: ["timetable"] });
    s.on("announcement:new", onAnnouncement);
    s.on("announcement:updated", onAnnouncement);
    s.on("timetable:updated", onTimetable);
    const onEvent = () => queryClient.invalidateQueries({ queryKey: ["events"] });
    s.on("event:new", onEvent);
    return () => {
      s.off("announcement:new", onAnnouncement);
      s.off("announcement:updated", onAnnouncement);
      s.off("timetable:updated", onTimetable);
      s.off("event:new", onEvent);
    };
  }, [queryClient]);
  // Get today's classes
  const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const today = days[new Date().getDay()] as any;
  const { data: timetableData } = useQuery({
    queryKey: ["timetable"],
    queryFn: async () => (await api.timetable()).timetable
  });
  const mappedTimetable = (timetableData || []).map((e: any) => ({
    id: e.id,
    courseCode: e.course_code,
    courseName: e.course_title,
    lecturer: "Course Rep",
    room: e.location || "TBD",
    day: (["monday", "tuesday", "wednesday", "thursday", "friday"][e.day_of_week] || "monday") as "monday" | "tuesday" | "wednesday" | "thursday" | "friday",
    startTime: String(e.start_time).slice(0, 5),
    endTime: String(e.end_time).slice(0, 5)
  }));
  const todayClasses = mappedTimetable.filter((entry) => entry.day === today);

  // Get pending assignments count (missed/unsubmitted only)
  const { data: assignmentsData } = useQuery({
    queryKey: ["assignments"],
    queryFn: async () => (await api.assignmentsList()).assignments
  });
  const now = new Date();
  const pendingAssignments = (assignmentsData || []).filter((a: any) => {
    if (a.is_submitted) return false;
    if (!a.due_at) return true;

    const dueDate = new Date(a.due_at);
    if (Number.isNaN(dueDate.getTime())) return true;

    return dueDate < now;
  }).length;

  // Get latest announcements
  const { data: announcementsData } = useQuery({
    queryKey: ["announcements", "feed"],
    queryFn: async () => (await api.announcementsFeed()).announcements
  });
  const priorityWeight: Record<string, number> = { high: 0, medium: 1, low: 2 };
  const latestAnnouncements = (announcementsData || []).map((a: any) => ({
    id: a.id,
    title: a.title,
    content: a.body,
    summary: a.summary || undefined,
    source: a.role_context,
    sourceRole: (a.role_context || "student").toLowerCase(),
    channelType: a.channel_type as string,
    level: (a.channel_type === "SCHOOL" ? "school" : a.channel_type === "GROUP" ? "group" : "department") as "school" | "department" | "group",
    priority: (a.priority || "low").toLowerCase(),
    timestamp: new Date(a.created_at)
  })).sort((a, b) => {
    const now = Date.now();
    const aAge = now - a.timestamp.getTime();
    const bAge = now - b.timestamp.getTime();
    const oneDayMs = 24 * 60 * 60 * 1000;
    // Both fresh (< 24h): sort by priority first, then recency
    if (aAge < oneDayMs && bAge < oneDayMs) {
      const pw = (priorityWeight[a.priority] ?? 2) - (priorityWeight[b.priority] ?? 2);
      if (pw !== 0) return pw;
      return b.timestamp.getTime() - a.timestamp.getTime();
    }
    // Otherwise: newer always wins
    return b.timestamp.getTime() - a.timestamp.getTime();
  }).slice(0, 5);

  const { data: recsData } = useQuery({
    queryKey: ["recommendations", user?.id],
    enabled: !!user?.id,
    queryFn: async () => await api.recommendResources(user!.id)
  });

  // Get upcoming events
  const { data: eventsData } = useQuery({
    queryKey: ["events", user?.department_id],
    queryFn: async () => (await api.listEvents(user?.department_id || undefined)).events
  });

  return (
    <MobileLayout title={getGreeting()} subtitle={user?.full_name || "Student"}>
      <div className="px-4 py-4 space-y-6">
        {/* Quick Stats */}
        <section className="grid grid-cols-2 gap-3">
          <QuickStatCard
            icon={FileText}
            label="Pending Tasks"
            value={pendingAssignments}
          />
          <QuickStatCard
            icon={Calendar}
            label="Classes Today"
            value={todayClasses.length}
          />
        </section>

        {/* Latest Announcements */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold font-serif text-foreground">
              Latest Announcements
            </h2>
            <Link to="/announcements">
              <Button variant="ghost" size="sm" className="text-primary text-sm">
                View all
              </Button>
            </Link>
          </div>
          {latestAnnouncements.length > 0 ? (
            <div className="flex gap-3 overflow-x-auto -mx-4 px-4 pb-1 snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {latestAnnouncements.map((announcement) => (
                <article
                  key={announcement.id}
                  onClick={() => navigate("/announcements", { state: { channelType: announcement.channelType } })}
                  className={cn(
                    "flex-none w-[82vw] max-w-xs bg-card rounded-2xl border border-border p-4 shadow-soft flex flex-col cursor-pointer active:scale-[0.98] snap-start transition-transform",
                    announcement.priority === "high" && "border-l-4 border-l-priority-high"
                  )}
                >
                  {/* Badges */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <LevelBadge level={announcement.level} />
                    <PriorityBadge priority={announcement.priority} />
                  </div>

                  {/* Title */}
                  <h3 className="font-serif font-semibold text-foreground text-base mb-2 leading-tight line-clamp-2">
                    {announcement.title}
                  </h3>

                  {/* Content — show AI summary when available, otherwise raw body */}
                  {announcement.summary ? (
                    <div className="mb-3">
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-1">
                        <Sparkles className="w-3 h-3" />
                        <span className="font-medium">AI Summary</span>
                      </div>
                      <p className="text-xs text-foreground/80 line-clamp-3">{announcement.summary}</p>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground mb-3 line-clamp-3">
                      {announcement.content}
                    </p>
                  )}

                  {/* Footer */}
                  <div className="mt-auto flex items-center justify-between text-[10px] text-muted-foreground pt-2 border-t border-border">
                    <span>{announcement.sourceRole}</span>
                    <time dateTime={announcement.timestamp.toISOString()}>
                      {formatDistanceToNow(announcement.timestamp, { addSuffix: true })}
                    </time>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="bg-card rounded-xl border border-border p-6 text-center">
              <Megaphone className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No announcements yet</p>
            </div>
          )}
        </section>

        {/* Today's Schedule */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold font-serif text-foreground">
              Today's Schedule
            </h2>
            <Link to="/timetable">
              <Button variant="ghost" size="sm" className="text-primary text-sm">
                View all
              </Button>
            </Link>
          </div>

          {todayClasses.length > 0 ? (
            <div className="flex gap-3 overflow-x-auto -mx-4 px-4 pb-1 snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {todayClasses.slice(0, 3).map((entry) => {
                const now = new Date();
                const currentMins = now.getHours() * 60 + now.getMinutes();

                const [sH, sM] = entry.startTime.split(":").map(Number);
                const startMins = sH * 60 + sM;

                const [eH, eM] = entry.endTime.split(":").map(Number);
                const endMins = eH * 60 + eM;

                const isNow = currentMins >= startMins && currentMins < endMins;

                return (
                  <div key={entry.id} className="flex-none w-[82vw] max-w-xs snap-start">
                    <TimetableCard entry={entry} isNow={isNow} />
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-card rounded-xl border border-border p-6 text-center">
              <Calendar className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No classes scheduled for today</p>
            </div>
          )}
        </section>

        {/* Upcoming Events */}
        {eventsData && eventsData.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold font-serif text-foreground">
                Upcoming Events
              </h2>
            </div>
            <div className="space-y-3">
              {eventsData.slice(0, 3).map((event: any) => (
                <div key={event.id} className="bg-card rounded-xl border border-border p-4 shadow-soft">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-medium text-foreground">{event.title}</h4>
                    <span className="text-xs bg-secondary px-2 py-0.5 rounded-full text-secondary-foreground">
                      {event.department_name || "All Departments"}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(event.date).toLocaleDateString()}
                    </div>
                    {event.time && (
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {String(event.time).slice(0, 5)}
                      </div>
                    )}
                    {event.venue && (
                      <div className="flex items-center gap-1">
                        <Building className="w-3 h-3" />
                        {event.venue}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* AI Recommendations Placeholder */}
        <section className="bg-accent/50 rounded-xl border border-border p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <BookOpen className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-semibold font-serif text-foreground mb-1">
                Recommended Resources
              </h3>
              <p className="text-xs text-muted-foreground mb-2">
                AI-powered suggestions based on your courses
              </p>
              <div className="flex flex-wrap gap-2">
                {(recsData?.recommended_resources || []).slice(0, 3).map((r: any) => (
                  <span
                    key={r.id}
                    className="text-xs bg-secondary px-2 py-1 rounded-md text-secondary-foreground hover:bg-secondary/80 cursor-pointer transition-colors"
                    onClick={async () => {
                      try {
                        toast.loading("Opening resource...");
                        const { resource } = await api.getResource(r.id);
                        toast.dismiss();
                        if (resource.signed_url) window.open(resource.signed_url, "_blank");
                        else toast.error("File unavailable");
                      } catch (e) {
                        toast.dismiss();
                        toast.error("Failed to open");
                      }
                    }}
                  >
                    {r.title}
                  </span>
                ))}
                {(!recsData?.recommended_resources || recsData.recommended_resources.length === 0) && (
                  <span className="text-xs text-muted-foreground">No recommendations yet</span>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </MobileLayout>
  );
}

import { MobileLayout } from "@/components/layout/MobileLayout";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { Megaphone, FileText, Calendar, Settings, Bell, Check, RefreshCw } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useState, useEffect } from "react";
import { getSocket } from "@/lib/socket";
import { toast } from "sonner";

const typeIcons = {
  ANNOUNCEMENT: Megaphone,
  ASSIGNMENT_DEADLINE: FileText,
  CLASS_REMINDER: Calendar,
  SYSTEM: Settings,
  announcement: Megaphone,
  assignment: FileText,
  timetable: Calendar,
  system: Settings,
};

const typeColors = {
  ANNOUNCEMENT: "bg-primary/10 text-primary",
  ASSIGNMENT_DEADLINE: "bg-status-warning/10 text-status-warning",
  CLASS_REMINDER: "bg-status-success/10 text-status-success",
  SYSTEM: "bg-muted text-muted-foreground",
  announcement: "bg-primary/10 text-primary",
  assignment: "bg-status-warning/10 text-status-warning",
  timetable: "bg-status-success/10 text-status-success",
  system: "bg-muted text-muted-foreground",
};

const typeLabels: Record<string, string> = {
  CLASS_REMINDER: "Upcoming Class",
  ASSIGNMENT_DEADLINE: "Assignment Due",
  ANNOUNCEMENT: "Announcement",
  SYSTEM: "System",
};

export default function Notifications() {
  const queryClient = useQueryClient();
  const [isGenerating, setIsGenerating] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => (await api.notificationsList()).notifications
  });

  // Refresh when a new notification arrives in real-time
  useEffect(() => {
    const s = getSocket();
    const handler = () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    };
    s.on("notification:new", handler);
    return () => { s.off("notification:new", handler); };
  }, [queryClient]);

  const { data: unreadData } = useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: async () => (await api.notificationsUnreadCount()).count
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => api.markNotificationRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["badge", "notifications"] });
    }
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => api.markAllNotificationsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["badge", "notifications"] });
    }
  });

  const generateMutation = useMutation({
    mutationFn: () => api.generateNotifications(),
    onMutate: () => setIsGenerating(true),
    onSuccess: async (result) => {
      const classes = result.classRemindersCreated ?? 0;
      const assignments = result.assignmentRemindersCreated ?? 0;
      const total = classes + assignments;

      // Fetch upcoming notifications and show toasts regardless of whether they
      // were newly created — so repeat clicks still pop up alerts
      try {
        const { notifications: upcoming } = await api.notificationsList();
        const now = new Date();
        const icons: Record<string, string> = { CLASS_REMINDER: "📅", ASSIGNMENT_DEADLINE: "📝" };
        const toShow = (upcoming as any[]).filter(
          (n) =>
            (n.type === "CLASS_REMINDER" || n.type === "ASSIGNMENT_DEADLINE") &&
            new Date(n.scheduled_for) > now
        );
        if (toShow.length > 0) {
          toShow.slice(0, 5).forEach((n) => {
            toast(`${icons[n.type] ?? "🔔"} ${n.title}`, {
              description: n.message,
              duration: 6000
            });
          });
        } else if (total === 0) {
          toast.info("No upcoming reminders found.");
        }
      } catch {
        if (total > 0) {
          const parts = [];
          if (classes > 0) parts.push(`${classes} class reminder${classes > 1 ? "s" : ""}`);
          if (assignments > 0) parts.push(`${assignments} assignment reminder${assignments > 1 ? "s" : ""}`);
          toast.success(`Added ${parts.join(" and ")}`);
        } else {
          toast.info("All reminders are up to date.");
        }
      }
      refetch();
    },
    onError: () => {
      toast.error("Failed to check for reminders. Try again.");
    },
    onSettled: () => setIsGenerating(false)
  });

  const notifications = (data || []).map((n: any) => ({
    id: n.id,
    title: n.title,
    message: n.message,
    type: n.type,
    read: !!n.read_at,
    timestamp: new Date(n.scheduled_for || n.created_at)
  }));

  const unreadCount = unreadData ?? 0;

  return (
    <MobileLayout title="Notifications" subtitle={`${unreadCount} unread`}>
      <div className="px-4 py-4">
        {/* Action Buttons */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => generateMutation.mutate()}
            disabled={isGenerating}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn("w-4 h-4", isGenerating && "animate-spin")} />
            <span>Check for reminders</span>
          </button>
          {unreadCount > 0 && (
            <button
              onClick={() => markAllReadMutation.mutate()}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-secondary text-secondary-foreground rounded-lg hover:bg-accent transition-colors"
            >
              <Check className="w-4 h-4" />
              <span>Mark all read</span>
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-card rounded-xl border border-border p-4 animate-pulse">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-muted" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-muted rounded w-3/4" />
                    <div className="h-3 bg-muted rounded w-1/2" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map((notification) => {
              const Icon = typeIcons[notification.type as keyof typeof typeIcons] || Bell;
              const colorClass = typeColors[notification.type as keyof typeof typeColors] || "bg-muted text-muted-foreground";

              return (
                <article
                  key={notification.id}
                  onClick={() => !notification.read && markReadMutation.mutate(notification.id)}
                  className={cn(
                    "bg-card rounded-xl border border-border p-4 shadow-soft transition-all cursor-pointer hover:shadow-card",
                    !notification.read && "border-l-4 border-l-primary bg-primary/5"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
                        colorClass
                      )}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-xs text-muted-foreground font-medium">
                            {typeLabels[notification.type] || notification.type}
                          </span>
                          <h3 className="font-medium text-sm text-foreground mt-0.5">
                            {notification.title}
                          </h3>
                        </div>
                        {!notification.read && (
                          <span className="w-2 h-2 bg-primary rounded-full flex-shrink-0 mt-1.5" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {notification.message}
                      </p>
                      <time className="text-xs text-muted-foreground mt-2 block">
                        {formatDistanceToNow(notification.timestamp, { addSuffix: true })}
                      </time>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {!isLoading && notifications.length === 0 && (
          <div className="text-center py-12">
            <Bell className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">No notifications yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Click "Check for reminders" to generate class and assignment alerts
            </p>
          </div>
        )}
      </div>
    </MobileLayout>
  );
}

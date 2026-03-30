import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useEffect } from "react";
import { getSocket } from "@/lib/socket";

/**
 * Returns unread/unseen badge counts for each bottom nav tab.
 * Polls every 60s and refreshes on real-time socket events.
 */
export function useBadgeCounts() {
  const queryClient = useQueryClient();

  // Invalidate counts when real-time events arrive
  useEffect(() => {
    const s = getSocket();
    const onNotif = () => queryClient.invalidateQueries({ queryKey: ["badge", "notifications"] });
    const onDM = () => queryClient.invalidateQueries({ queryKey: ["badge", "messages"] });
    const onAnnouncement = () => queryClient.invalidateQueries({ queryKey: ["badge", "announcements"] });
    s.on("notification:new", onNotif);
    s.on("dm:new", onDM);
    s.on("announcement:new", onAnnouncement);
    return () => {
      s.off("notification:new", onNotif);
      s.off("dm:new", onDM);
      s.off("announcement:new", onAnnouncement);
    };
  }, [queryClient]);

  const { data: notifCount } = useQuery({
    queryKey: ["badge", "notifications"],
    queryFn: () => api.notificationsUnreadCount().then((r) => r.count),
    refetchInterval: 60_000,
  });

  const { data: dmCount } = useQuery({
    queryKey: ["badge", "messages"],
    queryFn: () => api.dmUnreadCount().then((r) => r.count),
    refetchInterval: 60_000,
  });

  const { data: announcementCount } = useQuery({
    queryKey: ["badge", "announcements"],
    queryFn: () =>
      api
        .announcementUnreadCounts()
        .then((r) => r.counts.reduce((sum, c) => sum + Number(c.count), 0)),
    refetchInterval: 60_000,
  });

  const { data: assignmentsCount } = useQuery({
    queryKey: ["badge", "assignments"],
    queryFn: async () => {
      const { assignments } = await api.assignmentsList();
      const lastVisited = localStorage.getItem("lastVisitedAssignments");
      if (!lastVisited) return assignments.length > 0 ? assignments.length : 0;
      const since = new Date(Number(lastVisited));
      return assignments.filter((a: any) => new Date(a.created_at) > since).length;
    },
    refetchInterval: 120_000,
  });

  const { data: timetableCount } = useQuery({
    queryKey: ["badge", "timetable"],
    queryFn: async () => {
      const { timetable } = await api.timetable();
      const lastVisited = localStorage.getItem("lastVisitedTimetable");
      if (!lastVisited) return 0;
      const since = new Date(Number(lastVisited));
      return timetable.filter((e: any) => new Date(e.created_at) > since).length;
    },
    refetchInterval: 120_000,
  });

  return {
    notifications: notifCount ?? 0,
    messages: dmCount ?? 0,
    announcements: announcementCount ?? 0,
    assignments: assignmentsCount ?? 0,
    timetable: timetableCount ?? 0,
  };
}

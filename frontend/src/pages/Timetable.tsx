import { useMemo, useState, useEffect } from "react";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { TimetableCard } from "@/components/cards/TimetableCard";
import { cn } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { offlineApi } from "@/lib/offlineApi";
import { getSocket } from "@/lib/socket";

const days = [
  { label: "Mon", value: "monday" },
  { label: "Tue", value: "tuesday" },
  { label: "Wed", value: "wednesday" },
  { label: "Thu", value: "thursday" },
  { label: "Fri", value: "friday" },
] as const;

export default function Timetable() {
  const currentDayIndex = new Date().getDay();
  const defaultDay = currentDayIndex >= 1 && currentDayIndex <= 5 
    ? days[currentDayIndex - 1].value 
    : "monday";
  
  const [selectedDay, setSelectedDay] = useState<string>(defaultDay);

  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ["timetable"],
    queryFn: async () => (await offlineApi.timetable()).timetable
  });

  // Mark page as visited so nav badge clears
  useEffect(() => {
    localStorage.setItem("lastVisitedTimetable", String(Date.now()));
    queryClient.invalidateQueries({ queryKey: ["badge", "timetable"] });
  }, [queryClient]);

  // Refresh when course rep adds/edits/deletes an entry
  useEffect(() => {
    const s = getSocket();
    const handler = () => queryClient.invalidateQueries({ queryKey: ["timetable"] });
    s.on("timetable:updated", handler);
    return () => { s.off("timetable:updated", handler); };
  }, [queryClient]);

  const mapped = useMemo(() => {
    return (data || []).map((e: any) => ({
      id: e.id,
      courseCode: e.course_code,
      courseName: e.course_title,
      lecturer: "Course Rep",
      room: e.location || "TBD",
      day: ["monday", "tuesday", "wednesday", "thursday", "friday"][e.day_of_week] || "monday",
      startTime: String(e.start_time).slice(0, 5),
      endTime: String(e.end_time).slice(0, 5)
    }));
  }, [data]);

  const filteredClasses = mapped.filter((entry) => entry.day === selectedDay).sort((a, b) => a.startTime.localeCompare(b.startTime));

  return (
    <MobileLayout title="Timetable" subtitle="Your weekly schedule">
      <div className="px-4 py-4">
        {/* Day Selector */}
        <div className="flex gap-2 mb-6">
          {days.map((day) => {
            const isToday = days[currentDayIndex - 1]?.value === day.value;
            const isSelected = selectedDay === day.value;

            return (
              <button
                key={day.value}
                onClick={() => setSelectedDay(day.value)}
                className={cn(
                  "flex-1 py-3 rounded-xl text-sm font-medium transition-all relative",
                  isSelected
                    ? "bg-primary text-primary-foreground shadow-card"
                    : "bg-secondary text-secondary-foreground hover:bg-accent"
                )}
              >
                {day.label}
                {isToday && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-status-success rounded-full" />
                )}
              </button>
            );
          })}
        </div>

        {/* Classes List */}
        {filteredClasses.length > 0 ? (
          <div className="space-y-3">
            {filteredClasses.map((entry, index) => (
              <TimetableCard key={entry.id} entry={entry} />
            ))}
          </div>
        ) : (
          <div className="bg-card rounded-xl border border-border p-8 text-center">
            <p className="text-muted-foreground">No classes scheduled</p>
          </div>
        )}

        {/* Offline Ready Notice */}
        <div className="mt-6 p-3 bg-accent/50 rounded-lg border border-border">
          <p className="text-xs text-muted-foreground text-center">
            📱 Your timetable is available offline
          </p>
        </div>
      </div>
    </MobileLayout>
  );
}

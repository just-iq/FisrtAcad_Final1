import { useState } from "react";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  Calendar,
  Megaphone,
  Plus,
  Clock,
  MapPin,
  User,
  AlertTriangle,
  Trash2,
  Edit3,
  Send,
  GripVertical,
  BookOpen,
  FileText,
  MessageCircle,
  Sparkles
} from "lucide-react";
import { format } from "date-fns";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { getAuthUser } from "@/lib/auth";
import { TimetableCard } from "@/components/cards/TimetableCard";
import { AnnouncementCard } from "@/components/cards/AnnouncementCard";
import { QuickStatCard } from "@/components/cards/QuickStatCard";
import { Link } from "react-router-dom";
import { toast } from "sonner";

const tabs = [
  { label: "Rep Tools", value: "rep", icon: Megaphone },
  { label: "My Classes", value: "student", icon: BookOpen },
  { label: "Timetable", value: "timetable", icon: Calendar },
  { label: "Messages", value: "messages", icon: MessageCircle },
];

const days = [
  { label: "Monday", value: "monday" },
  { label: "Tuesday", value: "tuesday" },
  { label: "Wednesday", value: "wednesday" },
  { label: "Thursday", value: "thursday" },
  { label: "Friday", value: "friday" },
] as const;

const timeSlots = [
  "08:00", "09:00", "10:00", "11:00", "12:00",
  "13:00", "14:00", "15:00", "16:00", "17:00"
];

export default function CourseRepDashboard() {
  const user = getAuthUser();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("rep");
  const [selectedDay, setSelectedDay] = useState<string>("monday");
  const [showAddClass, setShowAddClass] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newClass, setNewClass] = useState({
    course_code: "",
    course_title: "",
    location: "",
    day: "monday",
    start_time: "09:00",
    end_time: "10:00"
  });

  // Announcement form state
  const [announcementForm, setAnnouncementForm] = useState({
    title: "",
    message: ""
  });

  // Post announcement mutation
  const postAnnouncementMutation = useMutation({
    mutationFn: async (payload: any) => await api.postAnnouncement(payload),
    onSuccess: () => {
      toast.success("Announcement sent to class!");
      queryClient.invalidateQueries({ queryKey: ["announcements"] });
      setAnnouncementForm({ title: "", message: "" });
    },
    onError: (error: Error) => {
      toast.error(`Failed: ${error.message}`);
    }
  });

  // Fetch timetable data from API
  const { data: timetableData, refetch: refetchTimetable } = useQuery({
    queryKey: ["timetable"],
    queryFn: async () => (await api.timetable()).timetable
  });

  const mappedTimetable = (timetableData || []).map((e: any) => ({
    id: e.id,
    courseCode: e.course_code,
    courseName: e.course_title,
    lecturer: "Course Rep",
    room: e.location || "TBD",
    // Cast strict type
    day: (["monday", "tuesday", "wednesday", "thursday", "friday"][e.day_of_week] || "monday") as "monday" | "tuesday" | "wednesday" | "thursday" | "friday",
    startTime: String(e.start_time).slice(0, 5),
    endTime: String(e.end_time).slice(0, 5)
  }));

  // Get today's classes for student view
  const weekDays = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const today = weekDays[new Date().getDay()] as any;
  const todayClasses = mappedTimetable.filter((entry) => entry.day === today);

  // Get assignments for student view
  const { data: assignmentsData } = useQuery({
    queryKey: ["assignments"],
    queryFn: async () => (await api.assignmentsList()).assignments
  });
  const pendingAssignments = (assignmentsData || []).length;

  // Get announcements for student view
  const { data: announcementsData } = useQuery({
    queryKey: ["announcements", "feed"],
    queryFn: async () => (await api.announcementsFeed()).announcements
  });
  const latestAnnouncements = (announcementsData || []).slice(0, 3).map((a: any) => ({
    id: a.id,
    title: a.title,
    content: a.body,
    summary: a.summary || undefined,
    source: a.role_context,
    sourceRole: (a.role_context || "student").toLowerCase(),
    level: (a.channel_type === "SCHOOL" ? "school" : a.channel_type === "GROUP" ? "group" : "department") as "school" | "department" | "group",
    priority: (a.priority || "low").toLowerCase(),
    timestamp: new Date(a.created_at)
  }));

  const filteredClasses = mappedTimetable
    .filter((entry) => entry.day === selectedDay)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  const isCurrentClass = (entry: { startTime: string; endTime: string }) => {
    const now = new Date();
    const [sh, sm] = entry.startTime.split(":").map(Number);
    const [eh, em] = entry.endTime.split(":").map(Number);
    const nowMins = now.getHours() * 60 + now.getMinutes();
    return nowMins >= sh * 60 + sm && nowMins < eh * 60 + em;
  };

  const handleDeleteClass = (id: string) => {
    api
      .deleteTimetableEntry(id)
      .then(() => {
        toast.success("Deleted");
        queryClient.invalidateQueries({ queryKey: ["timetable"] });
      })
      .catch((e: any) => toast.error(e?.message || "Delete failed"));
  };

  return (
    <MobileLayout title="Course Rep" subtitle={user?.full_name || "Dashboard"}>
      <div className="px-4 py-4">
        {/* Tabs */}
        <div className="flex gap-2 p-1 bg-secondary rounded-xl mb-4">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all",
                  activeTab === tab.value
                    ? "bg-card text-foreground shadow-soft"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Student View Tab - Course Rep is also a student */}
        {activeTab === "student" && (
          <div className="space-y-6">
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
                <div className="space-y-3">
                  {todayClasses.slice(0, 3).map((entry) => (
                    <TimetableCard key={entry.id} entry={entry} isNow={isCurrentClass(entry)} />
                  ))}
                </div>
              ) : (
                <div className="bg-card rounded-xl border border-border p-6 text-center">
                  <Calendar className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No classes scheduled for today</p>
                </div>
              )}
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
              <div className="space-y-3">
                {latestAnnouncements.map((announcement) => (
                  <AnnouncementCard key={announcement.id} announcement={announcement} />
                ))}
              </div>
            </section>
          </div>
        )}

        {/* Course Rep Tools - Urgent Announcements */}
        {activeTab === "rep" && (
          <div className="space-y-4">
            {/* Urgent Notice */}
            <div className="bg-priority-high/10 border border-priority-high/20 rounded-xl p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-priority-high flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-medium text-sm text-foreground">Quick Announcements</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Send urgent updates like venue changes, class cancellations, or time-sensitive notices to your classmates.
                </p>
              </div>
            </div>

            {/* Compose Urgent Announcement */}
            <div className="bg-card rounded-xl border border-border p-4 shadow-card space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-priority-high/10 flex items-center justify-center">
                  <Megaphone className="w-4 h-4 text-priority-high" />
                </div>
                <h3 className="font-serif font-semibold text-foreground">New Announcement</h3>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Title</Label>
                <Input
                  placeholder="e.g., CS301 Venue Change"
                  className="h-10 rounded-lg bg-secondary border-border"
                  value={announcementForm.title}
                  onChange={(e) => setAnnouncementForm({ ...announcementForm, title: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Message</Label>
                <Textarea
                  placeholder="Describe the update..."
                  className="min-h-[100px] rounded-lg bg-secondary border-border resize-none"
                  value={announcementForm.message}
                  onChange={(e) => setAnnouncementForm({ ...announcementForm, message: e.target.value })}
                />
              </div>

              <div className="flex items-center gap-2 px-3 py-2 bg-accent/40 rounded-lg border border-border text-xs text-muted-foreground">
                <Sparkles className="w-3.5 h-3.5 flex-shrink-0" />
                Priority is set automatically by AI after posting
              </div>

              <Button
                className="w-full h-11 rounded-xl bg-primary text-primary-foreground"
                onClick={() => {
                  if (!announcementForm.title || !announcementForm.message) {
                    toast.error("Please fill in title and message");
                    return;
                  }
                  if (!user?.department_id && !user?.group_id) {
                    toast.error("Your profile is missing department/group info. Contact an admin.");
                    return;
                  }
                  // Use GROUP channel if the rep has a group, otherwise DEPARTMENT_LEVEL
                  const channelType = user?.group_id ? "GROUP" : "DEPARTMENT_LEVEL";
                  postAnnouncementMutation.mutate({
                    title: announcementForm.title,
                    body: announcementForm.message,
                    channel_type: channelType,
                    group_id: user?.group_id ?? null,
                    department_id: user?.department_id ?? null,
                    level_id: user?.level_id ?? null
                  });
                }}
                disabled={postAnnouncementMutation.isPending}
              >
                <Send className="w-4 h-4 mr-2" />
                {postAnnouncementMutation.isPending ? "Sending..." : "Send to Class"}
              </Button>
            </div>
          </div>
        )}

        {/* Timetable Management Tab */}
        {activeTab === "timetable" && (
          <div className="space-y-4">
            {/* Day Selector */}
            <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4">
              {days.map((day) => (
                <button
                  key={day.value}
                  onClick={() => setSelectedDay(day.value)}
                  className={cn(
                    "px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all",
                    selectedDay === day.value
                      ? "bg-primary text-primary-foreground shadow-card"
                      : "bg-secondary text-secondary-foreground hover:bg-accent"
                  )}
                >
                  {day.label}
                </button>
              ))}
            </div>

            {/* Add/Edit Class Button */}
            <Button
              onClick={() => {
                if (editingId) {
                  setEditingId(null);
                  setShowAddClass(false);
                  setNewClass({
                    course_code: "",
                    course_title: "",
                    location: "",
                    day: "monday",
                    start_time: "09:00",
                    end_time: "10:00"
                  });
                } else {
                  setShowAddClass(!showAddClass);
                }
              }}
              className="w-full h-11 rounded-xl bg-primary text-primary-foreground"
            >
              <Plus className={cn("w-4 h-4 mr-2", editingId && "rotate-45")} />
              {editingId ? "Cancel Edit" : "Add Class"}
            </Button>

            {showAddClass && (
              <div className="bg-card rounded-xl border border-border p-4 shadow-card animate-fade-in space-y-4">
                <h3 className="font-serif font-semibold text-foreground">
                  {editingId ? "Update Class Entry" : "New Class Entry"}
                </h3>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-xs">Course Code</Label>
                    <Input
                      placeholder="CS301"
                      className="h-10 rounded-lg bg-secondary border-border"
                      value={newClass.course_code}
                      onChange={(e) => setNewClass({ ...newClass, course_code: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Room</Label>
                    <Input
                      placeholder="Room 101"
                      className="h-10 rounded-lg bg-secondary border-border"
                      value={newClass.location}
                      onChange={(e) => setNewClass({ ...newClass, location: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Course Name</Label>
                  <Input
                    placeholder="Data Structures and Algorithms"
                    className="h-10 rounded-lg bg-secondary border-border"
                    value={newClass.course_title}
                    onChange={(e) => setNewClass({ ...newClass, course_title: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Day</Label>
                  <Select value={newClass.day} onValueChange={(val: any) => setNewClass({ ...newClass, day: val })}>
                    <SelectTrigger className="h-10 rounded-lg bg-secondary border-border">
                      <SelectValue placeholder="Select day" />
                    </SelectTrigger>
                    <SelectContent>
                      {days.map((d) => (
                        <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-xs">Start Time</Label>
                    <Select value={newClass.start_time} onValueChange={(val) => setNewClass({ ...newClass, start_time: val })}>
                      <SelectTrigger className="h-10 rounded-lg bg-secondary border-border">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        {timeSlots.map((time) => (
                          <SelectItem key={time} value={time}>{time}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">End Time</Label>
                    <Select value={newClass.end_time} onValueChange={(val) => setNewClass({ ...newClass, end_time: val })}>
                      <SelectTrigger className="h-10 rounded-lg bg-secondary border-border">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        {timeSlots.map((time) => (
                          <SelectItem key={time} value={time}>{time}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    className="flex-1 h-10 rounded-lg"
                    onClick={() => {
                      setShowAddClass(false);
                      setEditingId(null);
                      setNewClass({
                        course_code: "",
                        course_title: "",
                        location: "",
                        day: "monday",
                        start_time: "09:00",
                        end_time: "10:00"
                      });
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="flex-1 h-10 rounded-lg bg-primary text-primary-foreground"
                    onClick={() => {
                      if (!newClass.course_code || !newClass.course_title) {
                        toast.error("Please fill course code and name");
                        return;
                      }
                      const dayIdx = { monday: 0, tuesday: 1, wednesday: 2, thursday: 3, friday: 4 } as any;

                      const payload = {
                        department_id: user?.department_id ?? null,
                        level_id: user?.level_id ?? null,
                        group_id: user?.group_id ?? null,
                        course_code: newClass.course_code,
                        course_title: newClass.course_title,
                        location: newClass.location,
                        day_of_week: dayIdx[newClass.day] ?? 0,
                        start_time: newClass.start_time,
                        end_time: newClass.end_time
                      };

                      const promise = editingId
                        ? api.updateTimetableEntry(editingId, payload)
                        : api.createTimetableEntry(payload);

                      promise
                        .then(() => {
                          toast.success(editingId ? "Class updated" : "Class added");
                          setShowAddClass(false);
                          setEditingId(null);
                          // Reset form
                          setNewClass({
                            course_code: "",
                            course_title: "",
                            location: "",
                            day: "monday",
                            start_time: "09:00",
                            end_time: "10:00"
                          });
                          queryClient.invalidateQueries({ queryKey: ["timetable"] });
                        })
                        .catch((e: any) => toast.error(e?.message || "Failed to save class"));
                    }}
                  >
                    {editingId ? "Update Class" : "Add Class"}
                  </Button>
                </div>
              </div>
            )}

            {/* Classes List - Draggable Style */}
            <div className="space-y-2">
              {filteredClasses.length > 0 ? (
                filteredClasses.map((entry) => (
                  <div
                    key={entry.id}
                    className="bg-card rounded-xl border border-border p-4 shadow-soft flex items-start gap-3"
                  >
                    <div className="text-muted-foreground cursor-grab active:cursor-grabbing">
                      <GripVertical className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                          {entry.courseCode}
                        </span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {entry.startTime} - {entry.endTime}
                        </span>
                      </div>
                      <h4 className="font-medium text-sm text-foreground truncate">
                        {entry.courseName}
                      </h4>
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {entry.lecturer}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {entry.room}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={() => {
                          setEditingId(entry.id);
                          setNewClass({
                            course_code: entry.courseCode,
                            course_title: entry.courseName,
                            location: entry.room,
                            day: entry.day,
                            start_time: entry.startTime,
                            end_time: entry.endTime
                          });
                          setShowAddClass(true);
                          // Scroll to form?
                        }}
                      >
                        <Edit3 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDeleteClass(entry.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="bg-card rounded-xl border border-border p-8 text-center">
                  <Calendar className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No classes on {selectedDay}</p>
                  <p className="text-xs text-muted-foreground mt-1">Click "Add Class" to schedule one</p>
                </div>
              )}
            </div>

            {/* Info Notice */}
            <div className="p-3 bg-accent/50 rounded-lg border border-border">
              <p className="text-xs text-muted-foreground text-center">
                💡 Drag classes to reorder • Changes sync to all students
              </p>
            </div>
          </div>

        )}

        {/* Messages Tab */}
        {activeTab === "messages" && (
          <div className="space-y-4">
            <div className="bg-card rounded-xl border border-border p-6 shadow-soft text-center">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <MessageCircle className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-serif font-semibold text-lg text-foreground mb-2">
                Student Messaging
              </h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-xs mx-auto">
                Send direct messages to students in your group.
              </p>

              <div className="flex flex-col gap-3">
                <Button
                  className="w-full h-11 rounded-xl"
                  onClick={() => window.location.href = "/messages?new=true"}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Start New Conversation
                </Button>
                <Button
                  variant="outline"
                  className="w-full h-11 rounded-xl"
                  onClick={() => window.location.href = "/messages"}
                >
                  View Inbox
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </MobileLayout >
  );
}

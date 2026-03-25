import { useState, useEffect } from "react";
import { Bell, Calendar, Users, Megaphone, Plus, Send, Clock, Building, BookOpen, FileText, MessageCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { getAuthUser } from "@/lib/auth";
import { TimetableCard } from "@/components/cards/TimetableCard";
import { AnnouncementCard } from "@/components/cards/AnnouncementCard";
import { QuickStatCard } from "@/components/cards/QuickStatCard";
import { Link } from "react-router-dom";
import { toast } from "sonner";

interface Event {
  id: string;
  title: string;
  date: string;
  time: string;
  venue: string;
  department: string;
  attendees: number;
}

interface DepartmentAnnouncement {
  id: string;
  title: string;
  content: string;
  department: string;
  timestamp: string;
  priority: "normal" | "important" | "urgent";
}

export default function StudentExecutiveDashboard() {
  const user = getAuthUser();
  const queryClient = useQueryClient();
  const [showEventForm, setShowEventForm] = useState(false);

  // Events state
  const [newEvent, setNewEvent] = useState({
    title: "",
    date: "",
    time: "",
    venue: "",
    department_id: "all"
  });

  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);

  // Fetch departments on mount
  useEffect(() => {
    api.getDepartments().then(res => setDepartments(res.departments)).catch(console.error);
  }, []);

  // Fetch events — include exec's department so dept-specific events show
  const { data: eventsData } = useQuery({
    queryKey: ["events", user?.department_id],
    queryFn: async () => (await api.listEvents(user?.department_id || undefined)).events
  });

  const createEventMutation = useMutation({
    mutationFn: async (payload: any) => await api.createEvent(payload),
    onSuccess: () => {
      toast.success("Event created successfully!");
      queryClient.invalidateQueries({ queryKey: ["events"] });
      setShowEventForm(false);
      setNewEvent({ title: "", date: "", time: "", venue: "", department_id: "all" });
    },
    onError: (e: any) => toast.error(e.message || "Failed to create event")
  });

  const handleCreateEvent = () => {
    createEventMutation.mutate(newEvent);
  };

  // Fetch levels for announcement target
  const { data: levelsData } = useQuery({
    queryKey: ["levels"],
    queryFn: async () => (await api.getLevels()).levels
  });

  // Announcement form state
  const [announcementForm, setAnnouncementForm] = useState({
    title: "",
    content: "",
    channel_scope: "department", // "department" | "school"
    level_id: "all"
  });

  // Post announcement mutation
  const postAnnouncementMutation = useMutation({
    mutationFn: async (payload: any) => await api.postAnnouncement(payload),
    onSuccess: () => {
      toast.success("Department announcement posted!");
      queryClient.invalidateQueries({ queryKey: ["announcements"] });
      setAnnouncementForm({ title: "", content: "", channel_scope: "department", level_id: "" });
    },
    onError: (error: Error) => {
      toast.error(`Failed: ${error.message}`);
    }
  });

  // Fetch API data
  const { data: timetableData } = useQuery({
    queryKey: ["timetable"],
    queryFn: async () => (await api.timetable()).timetable
  });

  const mappedTimetable = (timetableData || []).map((e: any) => ({
    id: e.id,
    courseCode: e.course_code,
    courseName: e.course_title,
    lecturer: "Lecturer",
    room: e.location || "TBD",
    day: (["monday", "tuesday", "wednesday", "thursday", "friday"][e.day_of_week] || "monday") as "monday" | "tuesday" | "wednesday" | "thursday" | "friday",
    startTime: String(e.start_time).slice(0, 5),
    endTime: String(e.end_time).slice(0, 5)
  }));

  const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const today = days[new Date().getDay()] as any;
  const todayClasses = mappedTimetable.filter((entry) => entry.day === today);

  const { data: assignmentsData } = useQuery({
    queryKey: ["assignments"],
    queryFn: async () => (await api.assignmentsList()).assignments
  });
  const pendingAssignments = (assignmentsData || []).length;

  const { data: announcementsData } = useQuery({
    queryKey: ["announcements", "feed"],
    queryFn: async () => (await api.announcementsFeed()).announcements
  });

  const myAnnouncements = (announcementsData || []).filter((a: any) => a.author_id === user?.id);
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



  const isCurrentClass = (entry: { startTime: string; endTime: string }) => {
    const now = new Date();
    const [sh, sm] = entry.startTime.split(":").map(Number);
    const [eh, em] = entry.endTime.split(":").map(Number);
    const nowMins = now.getHours() * 60 + now.getMinutes();
    return nowMins >= sh * 60 + sm && nowMins < eh * 60 + em;
  };

  return (
    <MobileLayout title="Student Executive" subtitle={user?.full_name || "Dashboard"}>
      <div className="p-4 pb-24 space-y-6">
        {/* Stats Overview */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="bg-card border-border">
            <CardContent className="p-3 text-center">
              <Megaphone className="w-5 h-5 mx-auto mb-1 text-primary" />
              <p className="text-lg font-bold text-foreground">{latestAnnouncements.length}</p>
              <p className="text-xs text-muted-foreground">Announcements</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-3 text-center">
              <Calendar className="w-5 h-5 mx-auto mb-1 text-primary" />
              <p className="text-lg font-bold text-foreground">{todayClasses.length}</p>
              <p className="text-xs text-muted-foreground">Classes Today</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-3 text-center">
              <FileText className="w-5 h-5 mx-auto mb-1 text-primary" />
              <p className="text-lg font-bold text-foreground">{pendingAssignments}</p>
              <p className="text-xs text-muted-foreground">Assignments</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="executive" className="w-full">
          <TabsList className="grid w-full grid-cols-4 bg-muted">
            <TabsTrigger value="executive" className="data-[state=active]:bg-background text-xs">
              <Megaphone className="w-4 h-4 mr-1" />
              Executive
            </TabsTrigger>
            <TabsTrigger value="student" className="data-[state=active]:bg-background text-xs">
              <BookOpen className="w-4 h-4 mr-1" />
              My Classes
            </TabsTrigger>
            <TabsTrigger value="events" className="data-[state=active]:bg-background text-xs">
              <Calendar className="w-4 h-4 mr-1" />
              Events
            </TabsTrigger>
            <TabsTrigger value="messages" className="data-[state=active]:bg-background text-xs">
              <MessageCircle className="w-4 h-4 mr-1" />
              Messages
            </TabsTrigger>
          </TabsList>

          {/* Student View Tab */}
          <TabsContent value="student" className="mt-4 space-y-4">
            <div className="space-y-6">
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
          </TabsContent>

          {/* Announcements Tab */}
          <TabsContent value="executive" className="mt-4 space-y-4">
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Bell className="w-4 h-4 text-primary" />
                  Post Department Announcement
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="ann-title" className="text-sm">Title</Label>
                  <Input
                    id="ann-title"
                    placeholder="Announcement title"
                    className="bg-background border-border"
                    value={announcementForm.title}
                    onChange={(e) => setAnnouncementForm({ ...announcementForm, title: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ann-content" className="text-sm">Content</Label>
                  <Textarea
                    id="ann-content"
                    placeholder="Write your announcement..."
                    className="bg-background border-border min-h-[100px]"
                    value={announcementForm.content}
                    onChange={(e) => setAnnouncementForm({ ...announcementForm, content: e.target.value })}
                  />
                </div>

                {/* Scope selector */}
                <div className="space-y-2">
                  <Label className="text-sm">Send To</Label>
                  <Select
                    value={announcementForm.channel_scope}
                    onValueChange={(val) => setAnnouncementForm({ ...announcementForm, channel_scope: val, level_id: "all" })}
                  >
                    <SelectTrigger className="bg-background border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="department">My Department</SelectItem>
                      <SelectItem value="school">All Departments (School-wide)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {announcementForm.channel_scope === "department" && (
                  <>
                    <div className="p-3 bg-accent/40 rounded-xl border border-border text-sm">
                      <span className="text-muted-foreground">Department: </span>
                      <span className="font-medium text-foreground">{user?.department?.name || "Your Department"}</span>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm">Target Level</Label>
                      <Select
                        value={announcementForm.level_id}
                        onValueChange={(val) => setAnnouncementForm({ ...announcementForm, level_id: val })}
                      >
                        <SelectTrigger className="bg-background border-border">
                          <SelectValue placeholder="All Levels" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Levels</SelectItem>
                          {(levelsData || []).map((l: any) => (
                            <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}

                <div className="flex items-center gap-2 px-3 py-2 bg-accent/40 rounded-lg border border-border text-xs text-muted-foreground">
                  <Sparkles className="w-3.5 h-3.5 flex-shrink-0 text-primary" />
                  Priority is set automatically by AI after posting
                </div>

                <Button
                  onClick={() => {
                    if (!announcementForm.title || !announcementForm.content) {
                      toast.error("Please fill in title and content");
                      return;
                    }
                    if (announcementForm.channel_scope === "department" && !user?.department_id) {
                      toast.error("Your profile has no department assigned. Contact an admin.");
                      return;
                    }
                    if (announcementForm.channel_scope === "school") {
                      postAnnouncementMutation.mutate({
                        title: announcementForm.title,
                        body: announcementForm.content,
                        channel_type: "SCHOOL"
                      });
                    } else {
                      postAnnouncementMutation.mutate({
                        title: announcementForm.title,
                        body: announcementForm.content,
                        channel_type: "DEPARTMENT_LEVEL",
                        department_id: user?.department_id ?? null,
                        level_id: (announcementForm.level_id && announcementForm.level_id !== "all") ? announcementForm.level_id : null
                      });
                    }
                  }}
                  disabled={postAnnouncementMutation.isPending}
                  className="w-full"
                >
                  <Send className="w-4 h-4 mr-2" />
                  {postAnnouncementMutation.isPending ? "Posting..." : "Post Announcement"}
                </Button>
              </CardContent>
            </Card>

            {/* Recent Announcements */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground">Recent From You</h3>
              {myAnnouncements.slice(0, 2).map((ann: any) => (
                <Card key={ann.id} className="bg-card border-border">
                  <CardContent className="p-4">
                    <h4 className="font-medium text-foreground mb-1">{ann.title}</h4>
                    <p className="text-sm text-muted-foreground mb-2 line-clamp-2">{ann.body}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      {new Date(ann.created_at).toLocaleDateString()}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Events Tab */}
          <TabsContent value="events" className="mt-4 space-y-4">
            <Button onClick={() => setShowEventForm(!showEventForm)} className="w-full">
              <Plus className="w-4 h-4 mr-2" />
              {showEventForm ? "Cancel" : "Create New Event"}
            </Button>

            {showEventForm && (
              <Card className="bg-card border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">New Event Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-sm">Event Title</Label>
                    <Input
                      placeholder="Enter event title"
                      className="bg-background border-border"
                      value={newEvent.title}
                      onChange={e => setNewEvent({ ...newEvent, title: e.target.value })}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-sm">Date</Label>
                      <Input
                        type="date"
                        className="bg-background border-border"
                        value={newEvent.date}
                        onChange={e => setNewEvent({ ...newEvent, date: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm">Time</Label>
                      <Input
                        type="time"
                        className="bg-background border-border"
                        value={newEvent.time}
                        onChange={e => setNewEvent({ ...newEvent, time: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm">Venue</Label>
                    <Input
                      placeholder="Event venue"
                      className="bg-background border-border"
                      value={newEvent.venue}
                      onChange={e => setNewEvent({ ...newEvent, venue: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm">Department</Label>
                    <Select value={newEvent.department_id} onValueChange={v => setNewEvent({ ...newEvent, department_id: v })}>
                      <SelectTrigger className="bg-background border-border">
                        <SelectValue placeholder="Select department" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Departments</SelectItem>
                        {departments.map((d: any) => (
                          <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Button onClick={handleCreateEvent} disabled={createEventMutation.isPending} className="w-full">
                    <Calendar className="w-4 h-4 mr-2" />
                    {createEventMutation.isPending ? "Creating..." : "Create Event"}
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Events List */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground">Upcoming Events</h3>
              {!eventsData || eventsData.length === 0 ? (
                <Card className="bg-card border-border">
                  <CardContent className="p-8 text-center">
                    <Calendar className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No upcoming events</p>
                    <p className="text-xs text-muted-foreground mt-1">Create your first event above</p>
                  </CardContent>
                </Card>
              ) : (
                eventsData.map((event: any) => (
                  <Card key={event.id} className="bg-card border-border">
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-medium text-foreground">{event.title}</h4>
                        <Badge variant="outline">{event.department_name || "All Departments"}</Badge>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(event.date).toLocaleDateString()}
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {event.time && String(event.time).slice(0, 5)}
                        </div>
                        <div className="flex items-center gap-1">
                          <Building className="w-3 h-3" />
                          {event.venue}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          {/* Messages Tab */}
          <TabsContent value="messages" className="mt-4 space-y-4">
            <Card className="bg-card border-border">
              <CardContent className="p-6 text-center">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <MessageCircle className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-serif font-semibold text-lg text-foreground mb-2">
                  Direct Messaging
                </h3>
                <p className="text-sm text-muted-foreground mb-6 max-w-xs mx-auto">
                  Reach out to students directly for specific inquiries or coordination.
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
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MobileLayout >
  );
}

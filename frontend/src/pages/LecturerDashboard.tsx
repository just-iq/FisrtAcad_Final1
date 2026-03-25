import { useMemo, useState, useEffect } from "react";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Megaphone, FileText, Upload, Send, Calendar, Plus, X, File, MessageCircle, Building, Clock, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getAuthUser } from "@/lib/auth";
import { getSocket } from "@/lib/socket";

const tabs = [
  { label: "Announce", value: "announce", icon: Megaphone },
  { label: "Assignments", value: "assignments", icon: FileText },
  { label: "Resources", value: "resources", icon: Upload },
  { label: "Events", value: "events", icon: Calendar },
  { label: "Messages", value: "messages", icon: MessageCircle },
];


function SubmissionsList({ assignmentId }: { assignmentId: string }) {
  const { data: submissions, isLoading } = useQuery({
    queryKey: ["submissions", assignmentId],
    queryFn: async () => (await api.listAssignmentSubmissions(assignmentId)).submissions,
  });

  if (isLoading) return <p className="text-xs text-muted-foreground p-2">Loading submissions...</p>;

  if (!submissions || submissions.length === 0) {
    return <p className="text-xs text-muted-foreground p-2">No submissions yet.</p>;
  }

  return (
    <div className="space-y-2">
      {submissions.map((sub: any) => (
        <div key={sub.id} className="flex items-center justify-between p-2 rounded-lg bg-background/50 border border-border text-xs">
          <div>
            <p className="font-medium text-foreground">{sub.student_name || "Unknown Student"}</p>
            <p className="text-muted-foreground">{new Date(sub.submitted_at).toLocaleString()}</p>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-primary hover:text-primary hover:bg-primary/10"
            onClick={() => {
              if (sub.signed_url) {
                window.open(sub.signed_url, "_blank");
              } else {
                toast.error("File unavailable");
              }
            }}
          >
            View File
          </Button>
        </div>
      ))}
    </div>
  );
}

export default function LecturerDashboard() {
  const user = getAuthUser();
  const queryClient = useQueryClient();

  // Refresh events when socket event arrives
  useEffect(() => {
    const s = getSocket();
    const onEvent = () => queryClient.invalidateQueries({ queryKey: ["events"] });
    s.on("event:new", onEvent);
    return () => {
      s.off("event:new", onEvent);
    };
  }, [queryClient]);

  const [activeTab, setActiveTab] = useState("announce");
  const [allowResubmission, setAllowResubmission] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [resourceTitle, setResourceTitle] = useState("");
  const [resourceFile, setResourceFile] = useState<File | null>(null);
  const [viewingAssignmentId, setViewingAssignmentId] = useState<string | null>(null);

  // Scope for assignment & resource targeting
  const [assignmentScope, setAssignmentScope] = useState({ department_id: "", level_id: "" });
  const [resourceScope, setResourceScope] = useState({ department_id: "", level_id: "" });

  // Form states

  const [announcementForm, setAnnouncementForm] = useState({
    title: "",
    body: "",
    channel_type: "SCHOOL" as "SCHOOL" | "DEPARTMENT_LEVEL",
    department_id: "",
    level_id: "",
  });

  const [assignmentForm, setAssignmentForm] = useState({
    title: "",
    description: "",
    due_at: "",
  });

  // Post announcement mutation
  const postAnnouncementMutation = useMutation({
    mutationFn: async (payload: any) => await api.postAnnouncement(payload),
    onSuccess: () => {
      toast.success("Announcement posted successfully!");
      queryClient.invalidateQueries({ queryKey: ["announcements"] });
      setAnnouncementForm({ title: "", body: "", channel_type: "SCHOOL", department_id: "", level_id: "" });
    },
    onError: (error: Error) => {
      toast.error(`Failed: ${error.message}`);
    }
  });

  // Create assignment mutation
  const createAssignmentMutation = useMutation({
    mutationFn: async (payload: any) => await api.createAssignment(payload),
    onSuccess: () => {
      toast.success("Assignment created successfully!");
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
      setAssignmentForm({ title: "", description: "", due_at: "" });
      setAssignmentScope({ department_id: "", level_id: "" });
      setAllowResubmission(false);
    },
    onError: (error: Error) => {
      toast.error(`Failed: ${error.message}`);
    }
  });

  const createResourceMutation = useMutation({
    mutationFn: async (formData: FormData) => await api.createResource(formData),
    onSuccess: () => {
      toast.success("Resource uploaded!");
      queryClient.invalidateQueries({ queryKey: ["resources"] });
      setResourceTitle("");
      setResourceFile(null);
      setUploadedFiles([]);
      setResourceScope({ department_id: "", level_id: "" });
    },
    onError: (error: Error) => {
      toast.error(`Failed: ${error.message}`);
    }
  });

  const { data: departmentsData } = useQuery({
    queryKey: ["departments"],
    queryFn: async () => (await api.getDepartments()).departments
  });

  const { data: levelsData } = useQuery({
    queryKey: ["levels"],
    queryFn: async () => (await api.getLevels()).levels
  });

  const { data: assignmentsData } = useQuery({
    queryKey: ["assignments"],
    queryFn: async () => (await api.assignmentsList()).assignments
  });

  const { data: resourcesData } = useQuery({
    queryKey: ["resources"],
    queryFn: async () => (await api.resourcesList()).resources
  });

  const { data: eventsData } = useQuery({
    queryKey: ["events", user?.department_id],
    queryFn: async () => (await api.listEvents(user?.department_id || undefined)).events
  });


  const myAssignments = useMemo(() => {
    return (assignmentsData || []).filter((a: any) => a.lecturer_id === user?.id);
  }, [assignmentsData, user?.id]);

  const myResources = useMemo(() => {
    return (resourcesData || []).filter((r: any) => r.lecturer_id === user?.id);
  }, [resourcesData, user?.id]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files[0]) {
      setResourceFile(files[0]);
      setUploadedFiles([files[0].name]);
      toast.success(`1 file added`);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      if (files[0]) {
        setResourceFile(files[0]);
        setUploadedFiles([files[0].name]);
        toast.success(`1 file added`);
      }
    }
  };

  const removeFile = (fileName: string) => {
    setUploadedFiles((prev) => prev.filter((f) => f !== fileName));
    if (resourceFile?.name === fileName) setResourceFile(null);
  };

  const handlePostAnnouncement = () => {
    if (!announcementForm.title || !announcementForm.body) {
      toast.error("Please fill in title and content");
      return;
    }

    if (announcementForm.channel_type === "DEPARTMENT_LEVEL") {
      if (!announcementForm.department_id) { toast.error("Please select a department"); return; }
      if (!announcementForm.level_id) { toast.error("Please select a level"); return; }
    }

    postAnnouncementMutation.mutate({
      title: announcementForm.title,
      body: announcementForm.body,
      channel_type: announcementForm.channel_type,
      department_id: announcementForm.channel_type === "DEPARTMENT_LEVEL" ? announcementForm.department_id : null,
      level_id: announcementForm.channel_type === "DEPARTMENT_LEVEL" ? announcementForm.level_id : null,
    });
  };

  const handleCreateAssignment = () => {
    if (!assignmentForm.title || !assignmentForm.description || !assignmentForm.due_at) {
      toast.error("Please fill in all fields");
      return;
    }
    if (!assignmentScope.department_id) { toast.error("Please select a department"); return; }
    if (!assignmentScope.level_id) { toast.error("Please select a level"); return; }
    createAssignmentMutation.mutate({
      title: assignmentForm.title,
      description: assignmentForm.description,
      due_at: new Date(assignmentForm.due_at).toISOString(),
      permit_resubmission: allowResubmission,
      department_id: assignmentScope.department_id,
      level_id: assignmentScope.level_id,
      group_id: null
    });
  };

  const handleUploadResource = () => {
    if (!resourceTitle.trim()) {
      toast.error("Please enter a resource title");
      return;
    }
    if (!resourceFile) {
      toast.error("Please select a file");
      return;
    }
    if (!resourceScope.department_id) { toast.error("Please select a department"); return; }
    if (!resourceScope.level_id) { toast.error("Please select a level"); return; }
    const fd = new FormData();
    fd.append("file", resourceFile);
    fd.append("title", resourceTitle.trim());
    fd.append("description", "");
    fd.append("department_id", resourceScope.department_id);
    fd.append("level_id", resourceScope.level_id);
    fd.append("group_id", "");
    createResourceMutation.mutate(fd);
  };

  return (
    <MobileLayout title="Lecturer Panel" subtitle="Create & manage content">
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
                  "flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-medium transition-all",
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

        {/* Announcements Tab */}
        {activeTab === "announce" && (
          <div className="space-y-4">
            <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
              <h3 className="font-serif font-semibold text-base text-foreground mb-4">
                Create Announcement
              </h3>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title" className="text-sm font-medium">
                    Title
                  </Label>
                  <Input
                    id="title"
                    placeholder="Announcement title"
                    className="h-11 rounded-xl"
                    value={announcementForm.title}
                    onChange={(e) => setAnnouncementForm({ ...announcementForm, title: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="content" className="text-sm font-medium">
                    Content
                  </Label>
                  <Textarea
                    id="content"
                    placeholder="Write your announcement..."
                    className="min-h-[120px] rounded-xl resize-none"
                    value={announcementForm.body}
                    onChange={(e) => setAnnouncementForm({ ...announcementForm, body: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Send to</Label>
                  <Select value={announcementForm.channel_type} onValueChange={(val: any) => setAnnouncementForm({ ...announcementForm, channel_type: val, department_id: "", level_id: "" })}>
                    <SelectTrigger className="h-11 rounded-xl">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SCHOOL">All students</SelectItem>
                      <SelectItem value="DEPARTMENT_LEVEL">A department</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-2 px-3 py-2 bg-accent/40 rounded-lg border border-border text-xs text-muted-foreground">
                  <Sparkles className="w-3.5 h-3.5 flex-shrink-0 text-primary" />
                  Priority is set automatically by AI after posting
                </div>

                {announcementForm.channel_type === "DEPARTMENT_LEVEL" && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Department</Label>
                      <Select value={announcementForm.department_id} onValueChange={(val) => setAnnouncementForm({ ...announcementForm, department_id: val })}>
                        <SelectTrigger className="h-11 rounded-xl">
                          <SelectValue placeholder="Select dept" />
                        </SelectTrigger>
                        <SelectContent>
                          {(departmentsData || []).map((d: any) => (
                            <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Level</Label>
                      <Select value={announcementForm.level_id} onValueChange={(val) => setAnnouncementForm({ ...announcementForm, level_id: val })}>
                        <SelectTrigger className="h-11 rounded-xl">
                          <SelectValue placeholder="Select level" />
                        </SelectTrigger>
                        <SelectContent>
                          {(levelsData || []).map((l: any) => (
                            <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                <Button
                  className="w-full h-11 rounded-xl"
                  onClick={handlePostAnnouncement}
                  disabled={postAnnouncementMutation.isPending}
                >
                  <Send className="w-4 h-4 mr-2" />
                  {postAnnouncementMutation.isPending ? "Posting..." : "Publish Announcement"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Assignments Tab */}
        {activeTab === "assignments" && (
          <div className="space-y-4">
            <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
              <h3 className="font-serif font-semibold text-base text-foreground mb-4">
                Create Assignment
              </h3>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="assignmentTitle" className="text-sm font-medium">
                    Title
                  </Label>
                  <Input
                    id="assignmentTitle"
                    placeholder="Assignment title"
                    className="h-11 rounded-xl"
                    value={assignmentForm.title}
                    onChange={(e) => setAssignmentForm({ ...assignmentForm, title: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description" className="text-sm font-medium">
                    Description
                  </Label>
                  <Textarea
                    id="description"
                    placeholder="Assignment instructions..."
                    className="min-h-[100px] rounded-xl resize-none"
                    value={assignmentForm.description}
                    onChange={(e) => setAssignmentForm({ ...assignmentForm, description: e.target.value })}
                  />
                </div>

                {/* Target scope */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Department</Label>
                    <Select value={assignmentScope.department_id} onValueChange={(val) => setAssignmentScope({ ...assignmentScope, department_id: val })}>
                      <SelectTrigger className="h-11 rounded-xl">
                        <SelectValue placeholder="Select dept" />
                      </SelectTrigger>
                      <SelectContent>
                        {(departmentsData || []).map((d: any) => (
                          <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Level</Label>
                    <Select value={assignmentScope.level_id} onValueChange={(val) => setAssignmentScope({ ...assignmentScope, level_id: val })}>
                      <SelectTrigger className="h-11 rounded-xl">
                        <SelectValue placeholder="Select level" />
                      </SelectTrigger>
                      <SelectContent>
                        {(levelsData || []).map((l: any) => (
                          <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Due Date</Label>
                  <Input
                    type="date"
                    className="h-11 rounded-xl"
                    value={assignmentForm.due_at}
                    onChange={(e) => setAssignmentForm({ ...assignmentForm, due_at: e.target.value })}
                  />
                </div>

                {/* Resubmission Toggle */}
                <div className="flex items-center justify-between p-3 bg-accent/50 rounded-xl border border-border">
                  <div>
                    <p className="text-sm font-medium text-foreground">Allow Resubmission</p>
                    <p className="text-xs text-muted-foreground">Students can resubmit</p>
                  </div>
                  <Switch
                    checked={allowResubmission}
                    onCheckedChange={setAllowResubmission}
                  />
                </div>

                <Button
                  className="w-full h-11 rounded-xl"
                  onClick={handleCreateAssignment}
                  disabled={createAssignmentMutation.isPending}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  {createAssignmentMutation.isPending ? "Creating..." : "Create Assignment"}
                </Button>
              </div>
            </div>

            {/* My Assignments */}
            <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
              <h3 className="font-serif font-semibold text-base text-foreground mb-3">
                My Assignments
              </h3>
              {myAssignments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No assignments yet.</p>
              ) : (
                <div className="space-y-4">
                  {myAssignments.slice(0, 10).map((a: any) => (
                    <div key={a.id} className="p-3 rounded-xl bg-accent/40 border border-border">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div>
                          <p className="text-sm font-medium text-foreground">{a.title}</p>
                          <p className="text-xs text-muted-foreground">
                            Due: {a.due_at ? new Date(a.due_at).toLocaleDateString() : "—"}
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs"
                          onClick={() => setViewingAssignmentId(viewingAssignmentId === a.id ? null : a.id)}
                        >
                          {viewingAssignmentId === a.id ? "Close" : "Submissions"}
                        </Button>
                      </div>

                      {/* Submissions List */}
                      {viewingAssignmentId === a.id && (
                        <div className="mt-2 pt-2 border-t border-border animate-in slide-in-from-top-1">
                          <SubmissionsList assignmentId={a.id} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Resources Tab */}
        {activeTab === "resources" && (
          <div className="space-y-4">
            <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
              <h3 className="font-serif font-semibold text-base text-foreground mb-4">
                Upload Resources
              </h3>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="resourceTitle" className="text-sm font-medium">
                    Title
                  </Label>
                  <Input
                    id="resourceTitle"
                    placeholder="Resource title"
                    className="h-11 rounded-xl"
                    value={resourceTitle}
                    onChange={(e) => setResourceTitle(e.target.value)}
                  />
                </div>

                {/* Target scope */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Department</Label>
                    <Select value={resourceScope.department_id} onValueChange={(val) => setResourceScope({ ...resourceScope, department_id: val })}>
                      <SelectTrigger className="h-11 rounded-xl">
                        <SelectValue placeholder="Select dept" />
                      </SelectTrigger>
                      <SelectContent>
                        {(departmentsData || []).map((d: any) => (
                          <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Level</Label>
                    <Select value={resourceScope.level_id} onValueChange={(val) => setResourceScope({ ...resourceScope, level_id: val })}>
                      <SelectTrigger className="h-11 rounded-xl">
                        <SelectValue placeholder="Select level" />
                      </SelectTrigger>
                      <SelectContent>
                        {(levelsData || []).map((l: any) => (
                          <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Drag & Drop Upload */}
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={cn(
                    "border-2 border-dashed rounded-xl p-6 text-center transition-all",
                    isDragging
                      ? "border-primary bg-primary/5"
                      : "border-border bg-accent/30"
                  )}
                >
                  <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground mb-2">
                    Drag & drop files here
                  </p>
                  <label>
                    <input
                      type="file"
                      multiple
                      className="hidden"
                      onChange={handleFileSelect}
                    />
                    <span className="text-sm text-primary font-medium cursor-pointer hover:underline">
                      or browse files
                    </span>
                  </label>
                </div>

                {/* Uploaded Files */}
                {uploadedFiles.length > 0 && (
                  <div className="space-y-2">
                    {uploadedFiles.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 bg-accent/50 rounded-lg border border-border"
                      >
                        <div className="flex items-center gap-2">
                          <File className="w-4 h-4 text-primary" />
                          <span className="text-sm text-foreground truncate max-w-[200px]">
                            {file}
                          </span>
                        </div>
                        <button
                          onClick={() => removeFile(file)}
                          className="text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <Button
                  className="w-full h-11 rounded-xl"
                  onClick={handleUploadResource}
                  disabled={uploadedFiles.length === 0 || createResourceMutation.isPending}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  {createResourceMutation.isPending ? "Uploading..." : "Upload Resources"}
                </Button>
              </div>
            </div>

            {/* My Resources */}
            <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
              <h3 className="font-serif font-semibold text-base text-foreground mb-3">
                My Resources
              </h3>
              {myResources.length === 0 ? (
                <p className="text-sm text-muted-foreground">No resources yet.</p>
              ) : (
                <div className="space-y-2">
                  {myResources.slice(0, 10).map((r: any) => (
                    <div key={r.id} className="p-3 rounded-xl bg-accent/40 border border-border">
                      <p className="text-sm font-medium text-foreground">{r.title}</p>
                      <p className="text-xs text-muted-foreground">{r.mime_type || "file"}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Events Tab */}
        {activeTab === "events" && (
          <div className="space-y-4">
            <h3 className="font-serif font-semibold text-base text-foreground mb-3">
              Upcoming Events
            </h3>
            {(!eventsData || eventsData.length === 0) ? (
              <div className="bg-card rounded-xl border border-border p-6 text-center shadow-soft">
                <Calendar className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No upcoming events</p>
                <p className="text-xs text-muted-foreground mt-1">Events created by Executives will appear here</p>
              </div>
            ) : (
              <div className="space-y-3">
                {eventsData.map((event: any) => (
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
            )}
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
                Send direct messages to students in your department or level.
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

            <div className="p-4 bg-accent/30 rounded-xl border border-border">
              <h4 className="text-sm font-medium text-foreground mb-1">Coming Soon: Batch Messages</h4>
              <p className="text-xs text-muted-foreground">
                Ability to send messages to entire groups at once.
                For now, use "Announcements" for broadcast updates.
              </p>
            </div>
          </div>
        )}
      </div>
    </MobileLayout>
  );
}

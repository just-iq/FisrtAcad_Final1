import { useState, useRef, useEffect } from "react";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { AssignmentStatus } from "@/types";
import { cn } from "@/lib/utils";
import { FileText, Presentation, File, Video, Upload, Calendar, RefreshCw, Check, X, Sparkles } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { offlineApi } from "@/lib/offlineApi";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { getAuthUser } from "@/lib/auth";

const tabs = [
  { label: "Assignments", value: "assignments" },
  { label: "Resources", value: "resources" },
];

const statusFilters: { label: string; value: AssignmentStatus | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "Submitted", value: "submitted" },
  { label: "Graded", value: "graded" },
  { label: "Missed", value: "missed" },
];

const resourceIcons = {
  pdf: FileText,
  slides: Presentation,
  document: File,
  video: Video,
};

export default function Assignments() {
  const user = getAuthUser();
  const queryClient = useQueryClient();

  // Mark this page as visited so the nav badge clears
  useEffect(() => {
    localStorage.setItem("lastVisitedAssignments", String(Date.now()));
    queryClient.invalidateQueries({ queryKey: ["badge", "assignments"] });
  }, [queryClient]);
  const [activeTab, setActiveTab] = useState("assignments");
  const [statusFilter, setStatusFilter] = useState<AssignmentStatus | "all">("all");
  const [expandedAssignment, setExpandedAssignment] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: assignmentsData } = useQuery({
    queryKey: ["assignments"],
    queryFn: async () => (await offlineApi.assignmentsList()).assignments
  });

  const { data: resourcesData } = useQuery({
    queryKey: ["resources"],
    queryFn: async () => (await api.resourcesList()).resources
  });

  const { data: recsData } = useQuery({
    queryKey: ["recommendations", user?.id],
    enabled: !!user?.id,
    queryFn: async () => await api.recommendResources(user!.id)
  });

  // SRS FIX: Add assignment submission mutation
  const submitMutation = useMutation({
    mutationFn: async ({ assignmentId, file }: { assignmentId: string; file: File }) => {
      const formData = new FormData();
      formData.append("file", file);
      return await api.submitAssignment(assignmentId, formData);
    },
    onSuccess: () => {
      toast.success("Assignment submitted successfully!");
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
      setUploadingId(null);
      setExpandedAssignment(null);
    },
    onError: (error: Error) => {
      toast.error(`Submission failed: ${error.message}`);
      setUploadingId(null);
    }
  });

  const mappedAssignments = (assignmentsData || []).map((a: any) => ({
    id: a.id,
    title: a.title,
    courseCode: "N/A",
    courseName: a.title,
    dueDate: a.due_at ? new Date(a.due_at) : new Date(),
    status: (a.is_submitted ? "submitted" : (a.due_at && new Date(a.due_at) < new Date() ? "missed" : "pending")) as AssignmentStatus,
    allowResubmission: !!a.permit_resubmission,
    description: a.description || undefined
  }));

  const filteredAssignments = mappedAssignments.filter((a) => statusFilter === "all" || a.status === statusFilter);

  const handleFileSelect = (assignmentId: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingId(assignmentId);
    submitMutation.mutate({ assignmentId, file });
  };

  const handleCardClick = (id: string) => {
    setExpandedAssignment(expandedAssignment === id ? null : id);
  };

  return (
    <MobileLayout title="Coursework" subtitle="Assignments & Resources">
      <div className="px-4 py-4">
        {/* Tabs */}
        <div className="flex gap-2 p-1 bg-secondary rounded-xl mb-4">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={cn(
                "flex-1 py-2.5 rounded-lg text-sm font-medium transition-all",
                activeTab === tab.value
                  ? "bg-card text-foreground shadow-soft"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "assignments" && (
          <>
            {/* Status Filter */}
            <div className="flex gap-2 mb-4 overflow-x-auto pb-2 -mx-4 px-4">
              {statusFilters.map((filter) => (
                <button
                  key={filter.value}
                  onClick={() => setStatusFilter(filter.value)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all",
                    statusFilter === filter.value
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground hover:bg-accent"
                  )}
                >
                  {filter.label}
                </button>
              ))}
            </div>

            {/* Assignments List with Submission */}
            <div className="space-y-3">
              {filteredAssignments.map((assignment) => {
                const daysUntilDue = differenceInDays(assignment.dueDate, new Date());
                const isOverdue = assignment.status === "missed";
                const isUrgent = daysUntilDue <= 2 && daysUntilDue >= 0 && !isOverdue;
                const isExpanded = expandedAssignment === assignment.id;
                const isUploading = uploadingId === assignment.id;

                return (
                  <article
                    key={assignment.id}
                    className={cn(
                      "bg-card rounded-xl border border-border p-4 shadow-soft transition-all cursor-pointer",
                      isUrgent && assignment.status === "pending" && "border-l-4 border-l-status-warning",
                      isOverdue && "border-l-4 border-l-destructive opacity-75",
                    )}
                    onClick={() => handleCardClick(assignment.id)}
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

                    {/* SRS FIX: Assignment Submission UI - shown when expanded */}
                    {isExpanded && (isOverdue ? (
                      <div className="mt-4 pt-4 border-t border-border" onClick={(e) => e.stopPropagation()}>
                        {assignment.description && (
                          <p className="text-sm text-muted-foreground mb-4">{assignment.description}</p>
                        )}
                        <p className="text-sm font-medium text-destructive">
                          ✕ Deadline has passed. This assignment can no longer be submitted.
                        </p>
                      </div>
                    ) : !assignment.allowResubmission && assignment.status === "submitted" ? (
                      <div className="mt-4 pt-4 border-t border-border" onClick={(e) => e.stopPropagation()}>
                        {assignment.description && (
                          <p className="text-sm text-muted-foreground mb-4">{assignment.description}</p>
                        )}
                        <p className="text-sm font-medium text-status-success">
                          ✓ You have submitted this assignment. Resubmissions are not allowed.
                        </p>
                      </div>
                    ) : (
                      <div className="mt-4 pt-4 border-t border-border" onClick={(e) => e.stopPropagation()}>
                        {assignment.description && (
                          <p className="text-sm text-muted-foreground mb-4">{assignment.description}</p>
                        )}

                        <div className="flex flex-col gap-3">
                          <p className="text-xs font-medium text-foreground">Submit your work:</p>

                          <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            onChange={handleFileSelect(assignment.id)}
                            accept=".pdf,.doc,.docx,.zip,.txt,.ppt,.pptx"
                          />

                          <Button
                            onClick={(e) => {
                              e.stopPropagation();
                              fileInputRef.current?.click();
                            }}
                            disabled={isUploading}
                            className="w-full h-11 rounded-xl"
                          >
                            <Upload className="w-4 h-4 mr-2" />
                            {isUploading ? "Uploading..." : "Upload Submission"}
                          </Button>

                          <p className="text-xs text-muted-foreground text-center">
                            Accepted: PDF, DOC, DOCX, ZIP, TXT, PPT, PPTX
                          </p>
                        </div>
                      </div>
                    ))}
                  </article>
                );
              })}
            </div>

            {filteredAssignments.length === 0 && (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No assignments found</p>
              </div>
            )}
          </>
        )}

        {activeTab === "resources" && (
          <div className="space-y-3">
            {/* AI Recommended Resources */}
            {(recsData?.recommended_resources || []).length > 0 && (
              <div className="bg-accent/50 rounded-xl border border-border p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-semibold text-foreground">Recommended for You</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(recsData.recommended_resources as any[]).slice(0, 5).map((r: any) => (
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
                        } catch {
                          toast.dismiss();
                          toast.error("Failed to open");
                        }
                      }}
                    >
                      {r.title}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {(resourcesData || []).map((resource: any) => {
              const Icon = resourceIcons["pdf"];
              return (
                <article
                  key={resource.id}
                  onClick={async () => {
                    try {
                      toast.loading("Opening resource...");
                      const { resource: r } = await api.getResource(resource.id);
                      toast.dismiss();
                      if (r.signed_url) {
                        window.open(r.signed_url, "_blank");
                      } else {
                        toast.error("Could not get download link");
                      }
                    } catch (e: any) {
                      toast.dismiss();
                      toast.error("Failed to open resource");
                    }
                  }}
                  className="bg-card rounded-xl border border-border p-4 shadow-soft flex items-start gap-3 cursor-pointer hover:bg-accent/50 transition-colors"
                >
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                      Resource
                    </span>
                    <h3 className="font-medium text-sm text-foreground mt-1.5 truncate">
                      {resource.title}
                    </h3>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      <span>{resource.mime_type || "file"}</span>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </MobileLayout>
  );
}

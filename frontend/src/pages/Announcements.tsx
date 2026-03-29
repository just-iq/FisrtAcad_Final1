import { useEffect, useRef, useState } from "react";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { cn } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { offlineApi } from "@/lib/offlineApi";
import { getSocket } from "@/lib/socket";
import { getAuthUser } from "@/lib/auth";
import { useLocation } from "react-router-dom";
import { formatDistanceToNow, format } from "date-fns";
import {
  Megaphone,
  Building,
  Users,
  GraduationCap,
  ChevronRight,
  Sparkles
} from "lucide-react";

interface Channel {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  type: "SCHOOL" | "DEPARTMENT_LEVEL" | "GROUP";
  unreadCount?: number;
}

interface Message {
  id: string;
  title: string;
  content: string;
  summary?: string;
  sender: string;
  senderRole: string;
  timestamp: Date;
  priority: "high" | "medium" | "low";
  isRead?: boolean;
}

const roleLabels: Record<string, string> = {
  admin: "Admin",
  lecturer: "Lecturer",
  student_exec: "Executive",
  student_executive: "Executive",
  course_rep: "Course Rep",
  student: "Student",
};

export default function Announcements() {
  const user = getAuthUser();
  const queryClient = useQueryClient();
  const location = useLocation();
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);

  const { data, error, isLoading, refetch } = useQuery({
    queryKey: ["announcements", "feed"],
    queryFn: async () => {
      const response = await offlineApi.announcementsFeed();
      const loaded = Array.isArray(response?.announcements) ? response.announcements : [];
      return loaded;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    networkMode: 'offlineFirst', // Use cache first, even if stale
    retry: (failureCount, error) => {
      // Don't retry if offline
      if (!navigator.onLine) return false;
      // Retry up to 2 times for network errors
      return failureCount < 2;
    },
    // Add initial data to prevent blank screen
    initialData: []
  });

  // Fetch unread counts (offline-aware)
  const { data: unreadData, refetch: refetchUnread } = useQuery({
    queryKey: ["announcements", "unread-counts"],
    queryFn: async () => (await offlineApi.announcementUnreadCounts()).counts,
    staleTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: (failureCount, error) => {
      if (!navigator.onLine) return false;
      return failureCount < 1;
    },
    initialData: []
  });

  // Mark channel as read when entering
  useEffect(() => {
    if (selectedChannel) {
      // Optimistically update cache to mark messages as read
      queryClient.setQueryData(
        ["announcements", "feed"],
        (old: any) => {
          if (!Array.isArray(old)) return old;
          return old.map((msg: any) => 
            msg.channel_type === selectedChannel.type 
              ? { ...msg, is_read: true }
              : msg
          );
        }
      );

      // Optimistically update unread counts
      queryClient.setQueryData(
        ["announcements", "unread-counts"],
        (old: any[]) => {
          if (!Array.isArray(old)) return old;
          return old.map(c => 
            c.channel_type === selectedChannel.type 
              ? { ...c, count: 0 }
              : c
          );
        }
      );

      // Update the total badge count
      const currentUnreadForChannel = (unreadData || []).find(c => c.channel_type === selectedChannel.type)?.count || 0;
      const currentTotal = queryClient.getQueryData(["badge", "announcements"]) as number || 0;
      const newTotal = Math.max(0, currentTotal - currentUnreadForChannel);
      queryClient.setQueryData(["badge", "announcements"], newTotal);

      // Then sync to backend and DB (don't refetch, keep optimistic update)
      offlineApi.markChannelRead(selectedChannel.type)
        .catch(console.error);
    }
  }, [selectedChannel, queryClient, unreadData]);

  // Live updates — new announcements and AI-enriched updates (summary/priority patch)
  useEffect(() => {
    const s = getSocket();
    const handler = () => {
      refetch();
      refetchUnread();
      queryClient.invalidateQueries({ queryKey: ["badge", "announcements"] });
    };
    s.on("announcement:new", handler);
    s.on("announcement:updated", handler);
    return () => {
      s.off("announcement:new", handler);
      s.off("announcement:updated", handler);
    };
  }, [refetch, refetchUnread]);

  // Build channels based on user's subscriptions
  const channels: Channel[] = [
    {
      id: "school",
      name: "School Announcements",
      description: "Updates for all students",
      icon: GraduationCap,
      type: "SCHOOL"
    }
  ];

  if (user?.department_id && user?.level_id) {
    channels.push({
      id: `dept_${user.department_id}_level_${user.level_id}`,
      name: "Department Updates",
      description: `Your department and level`,
      icon: Building,
      type: "DEPARTMENT_LEVEL"
    });
  }

  if (user?.group_id) {
    channels.push({
      id: `group_${user.group_id}`,
      name: "Group Channel",
      description: "Your Course Group",
      icon: Users,
      type: "GROUP"
    });
  }

  // Auto-select channel from Dashboard navigation
  useEffect(() => {
    const state = location.state as { channelType?: string } | null;
    if (state?.channelType && !selectedChannel) {
      const match = channels.find((c) => c.type === state.channelType);
      if (match) setSelectedChannel(match);
    }
  }, [location.state, channels.length]);

  const parseDate = (value: unknown): Date => {
    const date = value ? new Date(String(value)) : new Date();
    return Number.isNaN(date.getTime()) ? new Date() : date;
  };

  const safeFormat = (date: Date, formatStr: string) => {
    try {
      return format(date, formatStr);
    } catch {
      return "";
    }
  };

  const safeFormatDistanceToNow = (date: Date) => {
    try {
      return formatDistanceToNow(date, { addSuffix: false });
    } catch {
      return "";
    }
  };

  // Map announcements to messages
  const allMessages: Message[] = (data || []).map((a: any) => ({
    id: a.id,
    title: a.title,
    content: a.body,
    summary: a.summary || undefined,
    sender: a.role_context || "Unknown",
    senderRole: (a.role_context || "student").toLowerCase(),
    timestamp: parseDate(a.created_at),
    priority: (a.priority || "low").toLowerCase() as "high" | "medium" | "low",
    isRead: Boolean(a.is_read),
    channelType: a.channel_type
  }));

  // Filter messages for selected channel
  const channelMessages = selectedChannel
    ? allMessages.filter((m: any) => m.channelType === selectedChannel.type)
    : [];

  // Show helpful fallback when no announcements exist instead of a blank screen
  const hasMessages = allMessages.length > 0;

  // Get latest message for each channel (for preview)
  const getLatestMessage = (type: string) => {
    return allMessages.find((m: any) => m.channelType === type);
  };

  // Get unread count from NC API data with local fallback
  const getUnreadCount = (type: string) => {
    const found = (unreadData || []).find((c: any) => c.channel_type === type);
    if (found && found.count !== undefined) {
      return Number(found.count);
    }

    const localCount = allMessages.filter((m: any) => m.channelType === type && !m.isRead).length;
    return localCount;
  };

  // Get total message count for a channel
  const getMessageCount = (type: string) => {
    return allMessages.filter((m: any) => m.channelType === type).length;
  };

  // Auto-scroll to bottom when channel messages load
  const messagesEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (selectedChannel && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "instant" });
    }
  }, [selectedChannel, channelMessages.length]);

  // Channel List View
  if (!selectedChannel) {
    return (
      <MobileLayout title="Channels" subtitle="Announcements">
        <div className="px-4 py-4">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Megaphone className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="font-serif font-semibold text-lg text-foreground">Your Channels</h2>
              <p className="text-sm text-muted-foreground">
                {isLoading ? "Loading announcements..." : "Tap to view announcements"}
              </p>
            </div>
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="space-y-2 mb-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="w-full bg-card rounded-xl border border-border p-4 animate-pulse">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-muted"></div>
                    <div className="flex-1">
                      <div className="h-4 bg-muted rounded mb-2"></div>
                      <div className="h-3 bg-muted rounded w-3/4"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Error State */}
          {error && !isLoading && (
            <div className="text-center py-8">
              <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                <Megaphone className="w-6 h-6 text-red-500" />
              </div>
              <p className="text-red-500 font-medium mb-2">Failed to load announcements</p>
              <p className="text-sm text-muted-foreground mb-4">
                {navigator.onLine ? "Please try again" : "Check your internet connection"}
              </p>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium"
              >
                Retry
              </button>
            </div>
          )}

          {/* Channel List */}
          {!isLoading && !error && (
            <div className="space-y-2">
              {channels.map((channel) => {
                const Icon = channel.icon;
                const latest = getLatestMessage(channel.type);
                const unreadCount = getUnreadCount(channel.type);

                return (
                  <button
                    key={channel.id}
                    onClick={() => setSelectedChannel(channel)}
                    className="w-full bg-card rounded-xl border border-border p-4 flex items-center gap-4 hover:bg-accent/50 transition-colors text-left"
                  >
                    {/* Channel Icon */}
                    <div className={cn(
                      "w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0",
                      channel.type === "SCHOOL" && "bg-blue-500/10",
                      channel.type === "DEPARTMENT_LEVEL" && "bg-purple-500/10",
                      channel.type === "GROUP" && "bg-green-500/10"
                    )}>
                      <Icon className={cn(
                        "w-6 h-6",
                        channel.type === "SCHOOL" && "text-blue-500",
                        channel.type === "DEPARTMENT_LEVEL" && "text-purple-500",
                        channel.type === "GROUP" && "text-green-500"
                      )} />
                    </div>

                    {/* Channel Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className={cn(
                          "font-medium truncate",
                          unreadCount > 0 ? "text-foreground font-semibold" : "text-foreground"
                        )}>{channel.name}</h3>
                        {latest && (
                          <span className="text-xs text-muted-foreground flex-shrink-0 ml-2">
                            {safeFormatDistanceToNow(latest.timestamp)}
                          </span>
                        )}
                      </div>
                      <p className={cn(
                        "text-sm truncate",
                        unreadCount > 0 ? "text-foreground" : "text-muted-foreground"
                      )}>
                        {latest ? latest.title : channel.description}
                      </p>
                    </div>

                    {/* Unread Badge & Arrow */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {unreadCount > 0 && (
                        <span className="bg-primary text-primary-foreground text-xs font-medium px-2 py-0.5 rounded-full min-w-[20px] text-center">
                          {unreadCount}
                        </span>
                      )}
                      <ChevronRight className="w-5 h-5 text-muted-foreground" />
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {channels.length === 0 && !isLoading && !error && (
            <div className="text-center py-12">
              <Megaphone className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No channels available</p>
            </div>
          )}

          {!isLoading && !error && channels.length > 0 && !hasMessages && (
            <div className="text-center py-12">
              <Megaphone className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No announcements yet. Pull to refresh or wait for sync.</p>
              <button
                onClick={() => refetch()}
                className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium"
              >
                Reload
              </button>
            </div>
          )}

        </div>
      </MobileLayout>
    );
  }

  // Channel Detail View (Chat-style)
  const ChannelIcon = selectedChannel.icon;

  return (
    <MobileLayout
      title={selectedChannel.name}
      subtitle={isLoading ? "Loading..." : `${channelMessages.length} messages`}
      showBack={true}
      backAction={() => setSelectedChannel(null)}
    >
      <div className="flex flex-col h-full">
        {/* Channel Header */}
        <div className="px-4 py-3 bg-card border-b border-border flex items-center gap-3">
          <div className={cn(
            "w-10 h-10 rounded-full flex items-center justify-center",
            selectedChannel.type === "SCHOOL" && "bg-blue-500/10",
            selectedChannel.type === "DEPARTMENT_LEVEL" && "bg-purple-500/10",
            selectedChannel.type === "GROUP" && "bg-green-500/10"
          )}>
            <ChannelIcon className={cn(
              "w-5 h-5",
              selectedChannel.type === "SCHOOL" && "text-blue-500",
              selectedChannel.type === "DEPARTMENT_LEVEL" && "text-purple-500",
              selectedChannel.type === "GROUP" && "text-green-500"
            )} />
          </div>
          <div className="flex-1">
            <h2 className="font-medium text-foreground">{selectedChannel.name}</h2>
            <p className="text-xs text-muted-foreground">{selectedChannel.description}</p>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex-1 flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading messages...</p>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && !isLoading && (
          <div className="flex-1 flex items-center justify-center py-12">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                <Megaphone className="w-6 h-6 text-red-500" />
              </div>
              <p className="text-red-500 font-medium mb-2">Failed to load messages</p>
              <p className="text-sm text-muted-foreground mb-4">
                {navigator.onLine ? "Please try again" : "Check your internet connection"}
              </p>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Messages (Chat-style) */}
        {!isLoading && !error && (
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {channelMessages.length > 0 ? (
              channelMessages.slice().reverse().map((message, index, arr) => {
                const showDateSeparator = index === 0 ||
                safeFormat(message.timestamp, "yyyy-MM-dd") !==
                safeFormat(arr[index - 1].timestamp, "yyyy-MM-dd");

              return (
                <div key={message.id}>
                  {/* Date Separator */}
                  {showDateSeparator && (
                    <div className="flex justify-center mb-4">
                      <span className="bg-muted text-muted-foreground text-xs px-3 py-1 rounded-full">
                        {safeFormat(message.timestamp, "MMMM d, yyyy")}
                      </span>
                    </div>
                  )}

                  {/* Message Bubble */}
                    <div className={cn(
                      "bg-card rounded-2xl rounded-tl-sm border border-border p-4 shadow-sm max-w-[90%]",
                      message.priority === "high" && "border-l-4 border-l-red-500"
                    )}>
                      {/* Sender */}
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-medium text-primary">
                          {roleLabels[message.senderRole] || message.sender}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {safeFormat(message.timestamp, "h:mm a")}
                        </span>
                        {message.priority === "high" && (
                          <span className="bg-red-500/10 text-red-500 text-[10px] font-medium px-1.5 py-0.5 rounded">
                            URGENT
                          </span>
                        )}
                      </div>

                      {/* Title */}
                      <h4 className="font-semibold text-foreground mb-2">{message.title}</h4>

                      {/* Content */}
                      <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
                        {message.content}
                      </p>

                      {/* AI Summary */}
                      {message.summary && (
                        <div className="mt-3 bg-accent/50 rounded-lg p-3 border border-border">
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                            <Sparkles className="w-3 h-3" />
                            <span className="font-medium">AI Summary</span>
                          </div>
                          <p className="text-sm text-foreground/70">{message.summary}</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="flex-1 flex items-center justify-center py-12">
                <div className="text-center">
                  <Megaphone className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No messages in this channel yet</p>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Footer */}
        <div className="px-4 py-3 bg-muted/50 border-t border-border flex items-center justify-end">
          <p className="text-xs text-muted-foreground">📢 Broadcast only</p>
        </div>
      </div>
    </MobileLayout>
  );
}

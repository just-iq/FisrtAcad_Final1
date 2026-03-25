import { useEffect, useMemo, useState } from "react";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { Info, Lock } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { getAuthUser, primaryRole } from "@/lib/auth";
import { getSocket } from "@/lib/socket";

export default function Chat() {
  const user = getAuthUser();
  const role = primaryRole(user?.roles || []);
  const isAuthorizedToPost = ["ADMIN", "LECTURER", "STUDENT_EXEC", "COURSE_REP"].includes(role);
  const [text, setText] = useState("");

  const { data, refetch, isLoading } = useQuery({
    queryKey: ["messages"],
    queryFn: async () => (await api.messagesList()).messages
  });

  useEffect(() => {
    const s = getSocket();
    const handler = () => refetch();
    s.on("message:new", handler);
    return () => {
      s.off("message:new", handler);
    };
  }, [refetch]);

  const messages = useMemo(() => {
    return (data || []).map((m: any) => ({
      id: m.id,
      sender: m.sender_role,
      role: m.sender_role,
      message: m.body,
      timestamp: new Date(m.created_at)
    }));
  }, [data]);

  const onSend = async () => {
    if (!text.trim()) return;
    // Default target: user's own cohort room (dept+level), unless user has group_id -> group channel.
    const channel_type = user?.group_id ? "GROUP" : "DEPARTMENT_LEVEL";
    const payload: any = {
      body: text.trim(),
      channel_type,
      department_id: user?.department_id ?? null,
      level_id: user?.level_id ?? null,
      group_id: user?.group_id ?? null
    };
    await api.sendMessage(payload);
    setText("");
  };

  return (
    <MobileLayout title="Official Channel" subtitle="Academic communications">
      <div className="flex flex-col h-full">
        {/* Notice Banner */}
        <div className="mx-4 mt-4 p-3 bg-accent/50 rounded-lg border border-border flex items-start gap-2">
          <Info className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
          <p className="text-xs text-muted-foreground">
            This channel is for official academic communication only.
          </p>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {!isLoading && messages.map((msg: any) => (
            <div key={msg.id} className="bg-card rounded-xl border border-border p-4 shadow-soft">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-xs font-medium text-primary">
                    {msg.sender.charAt(0)}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{msg.sender}</p>
                  <p className="text-xs text-muted-foreground">{msg.role}</p>
                </div>
              </div>
              <p className="text-sm text-foreground/90 leading-relaxed">{msg.message}</p>
              <time className="text-xs text-muted-foreground mt-2 block">
                {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </time>
            </div>
          ))}
        </div>

        {/* Input Area - Locked for Students */}
        <div className="px-4 py-4 border-t border-border bg-card">
          {isAuthorizedToPost ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Type an official message..."
                className="flex-1 h-11 px-4 rounded-xl bg-secondary border-0 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
              <button
                className="h-11 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-medium"
                onClick={onSend}
              >
                Send
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 py-3 text-muted-foreground">
              <Lock className="w-4 h-4" />
              <span className="text-sm">Only authorized personnel can post messages</span>
            </div>
          )}
        </div>
      </div>
    </MobileLayout>
  );
}

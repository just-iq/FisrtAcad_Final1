import { useEffect, useState, useMemo, useRef } from "react";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { getAuthUser, primaryRole } from "@/lib/auth";
import { getSocket } from "@/lib/socket";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { Send, ArrowLeft, MessageCircle, Users, Lock, Search } from "lucide-react";

type Conversation = {
    id: string;
    other_user_id: string;
    other_user_name: string;
    other_user_email: string;
    body: string;
    created_at: string;
    unread_count: number;
};

type Message = {
    id: string;
    sender_id: string;
    receiver_id: string;
    sender_name?: string;
    body: string;
    created_at: string;
    read_at: string | null;
};

import { useSearchParams } from "react-router-dom";

export default function DirectMessages() {
    const user = getAuthUser();
    const role = primaryRole(user?.roles || []);
    const isStaff = ["ADMIN", "LECTURER", "STUDENT_EXEC", "COURSE_REP"].includes(role);

    const [searchParams] = useSearchParams();
    const startNewParams = searchParams.get("new");

    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
    const [text, setText] = useState("");
    const [showNewConversation, setShowNewConversation] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const queryClient = useQueryClient();

    // Initialize with new conversation mode if param exists
    useEffect(() => {
        if (startNewParams === "true" && isStaff) {
            setShowNewConversation(true);
        }
    }, [startNewParams, isStaff]);

    // Fetch conversations list
    const { data: conversationsData, refetch: refetchConversations } = useQuery({
        queryKey: ["dm", "conversations"],
        queryFn: async () => (await api.dmConversations()).conversations as Conversation[]
    });

    // Fetch current conversation
    const { data: conversationData, refetch: refetchConversation } = useQuery({
        queryKey: ["dm", "conversation", selectedUserId],
        queryFn: async () => selectedUserId ? await api.dmConversation(selectedUserId) : null,
        enabled: !!selectedUserId
    });

    // Fetch potential recipients (for staff only)
    const { data: recipientsData } = useQuery({
        queryKey: ["dm", "recipients", searchTerm],
        queryFn: async () => (await api.dmRecipients(searchTerm)).recipients || [],
        enabled: isStaff && showNewConversation
    });

    // Send message mutation
    const sendMutation = useMutation({
        mutationFn: (payload: { receiver_id: string; body: string }) => api.sendDM(payload),
        onSuccess: () => {
            setText("");
            refetchConversation();
            refetchConversations();
        }
    });

    // Real-time updates
    useEffect(() => {
        const socket = getSocket();
        const handler = () => {
            refetchConversations();
            if (selectedUserId) refetchConversation();
            queryClient.invalidateQueries({ queryKey: ["badge", "messages"] });
        };
        socket.on("dm:new", handler);
        return () => {
            socket.off("dm:new", handler);
        };
    }, [refetchConversations, refetchConversation, selectedUserId, queryClient]);

    // When a conversation is opened, refresh badge count (messages are shown = "read")
    useEffect(() => {
        if (selectedUserId) {
            queryClient.invalidateQueries({ queryKey: ["badge", "messages"] });
        }
    }, [selectedUserId, queryClient]);

    // Scroll to bottom on new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [conversationData?.messages]);

    const conversations = conversationsData || [];
    const messages = useMemo(() => {
        const msgs = conversationData?.messages || [];
        return [...msgs].reverse(); // API returns DESC, we want ASC for display
    }, [conversationData?.messages]);
    const otherUser = conversationData?.otherUser;

    const onSend = () => {
        if (!text.trim() || !selectedUserId) return;
        sendMutation.mutate({ receiver_id: selectedUserId, body: text.trim() });
    };

    const startNewConversation = (recipientId: string) => {
        setSelectedUserId(recipientId);
        setShowNewConversation(false);
        setSearchTerm("");
    };

    const getBackPath = () => {
        if (role === 'ADMIN') return '/admin';
        if (role === 'LECTURER') return '/lecturer';
        if (role === 'COURSE_REP') return '/course-rep';
        if (role === 'STUDENT_EXEC') return '/student-executive';
        return '/dashboard';
    };

    // Conversation list view
    if (!selectedUserId && !showNewConversation) {
        return (
            <MobileLayout 
                title="Messages" 
                subtitle="Personal conversations"
                showBack={isStaff}
                backPath={getBackPath()}
            >
                <div className="flex flex-col h-full">
                    {/* New Conversation Button (Staff only) */}
                    {isStaff && (
                        <div className="px-4 pt-4">
                            <button
                                onClick={() => setShowNewConversation(true)}
                                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary text-primary-foreground rounded-xl font-medium hover:bg-primary/90 transition-colors"
                            >
                                <Users className="w-4 h-4" />
                                Start New Conversation
                            </button>
                        </div>
                    )}

                    {/* Conversations List */}
                    <div className="flex-1 overflow-y-auto px-4 py-4">
                        {conversations.length > 0 ? (
                            <div className="space-y-2">
                                {conversations.map((conv) => (
                                    <button
                                        key={conv.other_user_id}
                                        onClick={() => setSelectedUserId(conv.other_user_id)}
                                        className={cn(
                                            "w-full bg-card rounded-xl border border-border p-4 text-left transition-all hover:shadow-card",
                                            conv.unread_count > 0 && "border-l-4 border-l-primary bg-primary/5"
                                        )}
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                                <span className="text-sm font-medium text-primary">
                                                    {conv.other_user_name?.charAt(0).toUpperCase() || "?"}
                                                </span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between gap-2">
                                                    <h3 className="font-medium text-sm text-foreground truncate">
                                                        {conv.other_user_name}
                                                    </h3>
                                                    {conv.unread_count > 0 && (
                                                        <span className="px-2 py-0.5 bg-primary text-primary-foreground text-xs rounded-full">
                                                            {conv.unread_count}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-xs text-muted-foreground truncate mt-0.5">
                                                    {conv.body}
                                                </p>
                                                <time className="text-xs text-muted-foreground mt-1 block">
                                                    {formatDistanceToNow(new Date(conv.created_at), { addSuffix: true })}
                                                </time>
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-12">
                                <MessageCircle className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                                <p className="text-muted-foreground">No conversations yet</p>
                                {isStaff ? (
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Start a new conversation with a student
                                    </p>
                                ) : (
                                    <p className="text-xs text-muted-foreground mt-1">
                                        You'll see messages from staff here
                                    </p>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Student Notice */}
                    {!isStaff && (
                        <div className="px-4 pb-4">
                            <div className="flex items-center gap-2 p-3 bg-accent/50 rounded-lg border border-border">
                                <Lock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                                <p className="text-xs text-muted-foreground">
                                    Only lecturers, course reps, and executives can start conversations
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </MobileLayout>
        );
    }

    // New conversation (recipient selection) view
    if (showNewConversation && isStaff) {
        return (
            <MobileLayout title="New Message" subtitle="Select a student">
                <div className="flex flex-col h-full">
                    {/* Back button */}
                    <div className="px-4 pt-4">
                        <button
                            onClick={() => {
                                setShowNewConversation(false);
                                setSearchTerm("");
                            }}
                            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Back to conversations
                        </button>
                    </div>

                    {/* Search */}
                    <div className="px-4 py-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <input
                                type="text"
                                placeholder="Search students..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full h-11 pl-10 pr-4 rounded-xl bg-secondary border-0 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                            />
                        </div>
                    </div>

                    {/* Recipients list */}
                    <div className="flex-1 overflow-y-auto px-4 pb-4">
                        {(recipientsData || []).length > 0 ? (
                            <div className="space-y-2">
                                {(recipientsData || []).map((recipient: any) => (
                                    <button
                                        key={recipient.id}
                                        onClick={() => startNewConversation(recipient.id)}
                                        className="w-full bg-card rounded-xl border border-border p-4 text-left transition-all hover:shadow-card"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                                <span className="text-sm font-medium text-primary">
                                                    {recipient.full_name?.charAt(0).toUpperCase() || "?"}
                                                </span>
                                            </div>
                                            <div>
                                                <h3 className="font-medium text-sm text-foreground">
                                                    {recipient.full_name}
                                                </h3>
                                                <p className="text-xs text-muted-foreground">
                                                    {recipient.email}
                                                </p>
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-12">
                                <p className="text-muted-foreground">No students found</p>
                            </div>
                        )}
                    </div>
                </div>
            </MobileLayout>
        );
    }

    // Conversation view
    return (
        <MobileLayout
            title={otherUser?.full_name || "Conversation"}
            subtitle={otherUser?.email || ""}
        >
            <div className="flex flex-col h-full">
                {/* Back button */}
                <div className="px-4 py-3 border-b border-border">
                    <button
                        onClick={() => setSelectedUserId(null)}
                        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back to conversations
                    </button>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                    {messages.map((msg) => {
                        const isMine = msg.sender_id === user?.id;
                        return (
                            <div
                                key={msg.id}
                                className={cn("flex", isMine ? "justify-end" : "justify-start")}
                            >
                                <div
                                    className={cn(
                                        "max-w-[80%] rounded-2xl px-4 py-2.5",
                                        isMine
                                            ? "bg-primary text-primary-foreground rounded-br-sm"
                                            : "bg-card border border-border rounded-bl-sm"
                                    )}
                                >
                                    <p className="text-sm">{msg.body}</p>
                                    <time
                                        className={cn(
                                            "text-xs mt-1 block",
                                            isMine ? "text-primary-foreground/70" : "text-muted-foreground"
                                        )}
                                    >
                                        {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                                    </time>
                                </div>
                            </div>
                        );
                    })}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="px-4 py-4 border-t border-border bg-card">
                    <div className="flex items-center gap-2">
                        <input
                            type="text"
                            placeholder="Type a message..."
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && onSend()}
                            className="flex-1 h-11 px-4 rounded-xl bg-secondary border-0 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                        <button
                            onClick={onSend}
                            disabled={!text.trim() || sendMutation.isPending}
                            className="h-11 w-11 rounded-xl bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-50 transition-opacity"
                        >
                            <Send className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>
        </MobileLayout>
    );
}

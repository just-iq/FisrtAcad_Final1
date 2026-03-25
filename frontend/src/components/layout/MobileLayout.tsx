import { ReactNode, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { BottomNav } from "./BottomNav";
import { Header } from "./Header";
import { cn } from "@/lib/utils";
import { ArrowLeft, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getSocket } from "@/lib/socket";
import { toast } from "sonner";
import { registerPushNotifications } from "@/lib/push";

interface MobileLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
  showNav?: boolean;
  showHeader?: boolean;
  showBack?: boolean;
  backPath?: string;
  backAction?: () => void;
  className?: string;
}

export function MobileLayout({
  children,
  title,
  subtitle,
  showNav = true,
  showHeader = true,
  showBack = false,
  backPath = "/dashboard",
  backAction,
  className,
}: MobileLayoutProps) {
  const navigate = useNavigate();
  const { logout, currentRole, availableRoles, switchRole } = useAuth();

  // Register Web Push once per session
  useEffect(() => {
    registerPushNotifications();
  }, []);

  // Global real-time notification toasts — shows on every page
  useEffect(() => {
    const s = getSocket();
    const handler = (n: any) => {
      const icons: Record<string, string> = {
        CLASS_REMINDER: "📅",
        ASSIGNMENT_DEADLINE: "📝",
        ANNOUNCEMENT: "📢",
        SYSTEM: "🔔"
      };
      const icon = icons[n?.type] ?? "🔔";
      toast(`${icon} ${n?.title ?? "New notification"}`, {
        description: n?.message,
        duration: 6000
      });
    };
    s.on("notification:new", handler);
    return () => { s.off("notification:new", handler); };
  }, []);

  // Global DM toast
  useEffect(() => {
    const s = getSocket();
    const handler = (msg: any) => {
      toast(`💬 New message from ${msg?.sender_name ?? "someone"}`, {
        description: msg?.body ? String(msg.body).slice(0, 80) : undefined,
        duration: 5000
      });
    };
    s.on("dm:new", handler);
    return () => { s.off("dm:new", handler); };
  }, []);

  const handleLogout = () => {
    logout();
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {showHeader && (
        <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border safe-top">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              {showBack && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-xl"
                  onClick={() => backAction ? backAction() : navigate(backPath)}
                >
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              )}
              <div>
                <h1 className="text-lg font-semibold font-serif text-foreground">
                  {title}
                </h1>
                {subtitle && (
                  <p className="text-xs text-muted-foreground">{subtitle}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {availableRoles.length > 1 && (
                <Select value={currentRole} onValueChange={(v) => switchRole(v)}>
                  <SelectTrigger className="h-9 rounded-xl bg-card border-border text-xs w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableRoles.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              <Button
                variant="ghost"
                size="icon"
                className="rounded-xl text-muted-foreground hover:text-foreground"
                onClick={() => navigate("/profile")}
                title="Profile"
              >
                <User className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </header>
      )}
      <main
        className={cn(
          "flex-1 overflow-y-auto",
          showNav && "pb-20",
          className
        )}
      >
        {children}
      </main>
      {showNav && currentRole === "STUDENT" && <BottomNav />}
    </div>
  );
}

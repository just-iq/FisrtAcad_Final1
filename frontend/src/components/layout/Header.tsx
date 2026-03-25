import { cn } from "@/lib/utils";
import { Bell, Menu, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface HeaderProps {
  title: string;
  subtitle?: string;
  showNotifications?: boolean;
  showMenu?: boolean;
  className?: string;
}

export function Header({
  title,
  subtitle,
  showNotifications = true,
  showMenu = false,
  className,
}: HeaderProps) {
  return (
    <header
      className={cn(
        "sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border safe-top",
        className
      )}
    >
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          {showMenu && (
            <Button variant="ghost" size="icon" className="rounded-xl">
              <Menu className="w-5 h-5" />
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
          {showNotifications && (
            <Button
              variant="ghost"
              size="icon"
              className="rounded-xl relative"
            >
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-priority-high rounded-full" />
            </Button>
          )}
          <Avatar className="w-8 h-8 border border-border">
            <AvatarFallback className="bg-secondary text-secondary-foreground text-xs">
              <User className="w-4 h-4" />
            </AvatarFallback>
          </Avatar>
        </div>
      </div>
    </header>
  );
}

import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface QuickStatCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  trend?: "up" | "down" | "neutral";
  className?: string;
}

export function QuickStatCard({
  icon: Icon,
  label,
  value,
  trend,
  className,
}: QuickStatCardProps) {
  return (
    <div
      className={cn(
        "bg-card rounded-xl border border-border p-4 shadow-soft",
        className
      )}
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon className="w-5 h-5 text-primary" />
        </div>
        <div>
          <p className="text-2xl font-bold font-serif text-foreground">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </div>
    </div>
  );
}

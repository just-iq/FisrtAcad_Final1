import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Wifi, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OfflineIndicatorProps {
  className?: string;
}

export function OfflineIndicator({ className }: OfflineIndicatorProps) {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <Alert className={cn("border-orange-200 bg-orange-50", className)}>
      <WifiOff className="h-4 w-4 text-orange-600" />
      <AlertDescription className="text-orange-800">
        You're currently offline. Some features may be limited. Changes will sync when connection is restored.
      </AlertDescription>
    </Alert>
  );
}

export function OnlineIndicator({ className }: OfflineIndicatorProps) {
  const isOnline = useOnlineStatus();

  if (!isOnline) return null;

  return (
    <Alert className={cn("border-green-200 bg-green-50", className)}>
      <Wifi className="h-4 w-4 text-green-600" />
      <AlertDescription className="text-green-800">
        Back online! Syncing your changes...
      </AlertDescription>
    </Alert>
  );
}
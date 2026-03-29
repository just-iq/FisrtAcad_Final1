import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Wifi, WifiOff, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';
import { syncService } from '@/lib/sync';

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
  const [syncInProgress, setSyncInProgress] = useState(false);

  useEffect(() => {
    // Subscribe to sync status changes
    const unsubscribe = syncService.onSyncStatusChange(setSyncInProgress);
    return unsubscribe;
  }, []);

  // Show indicator when online AND syncing is in progress
  if (!isOnline || !syncInProgress) return null;

  return (
    <Alert className={cn("border-blue-200 bg-blue-50", className)}>
      <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
      <AlertDescription className="text-blue-800">
        Back online! Syncing your changes...
      </AlertDescription>
    </Alert>
  );
}
import { useOnlineStatus } from './useOnlineStatus';

export function useOfflineCapabilities() {
  const isOnline = useOnlineStatus();

  return {
    isOnline,
    canPerformAction: (action: 'read' | 'write' | 'sync') => {
      switch (action) {
        case 'read':
          return true; // Can always read cached data
        case 'write':
          return isOnline; // Can only write when online
        case 'sync':
          return isOnline; // Can only sync when online
        default:
          return false;
      }
    },
    getOfflineMessage: (action: string) => {
      return `Cannot ${action} while offline. This action will be performed when connection is restored.`;
    }
  };
}
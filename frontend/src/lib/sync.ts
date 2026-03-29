import { getPendingActions, removePendingAction, updatePendingActionRetries, markAsSynced } from './offlineDB';
import { api } from './api';

export class SyncService {
  private static instance: SyncService;
  private isOnline: boolean = navigator.onLine;
  private syncInProgress: boolean = false;

  private constructor() {
    this.setupOnlineListener();
  }

  static getInstance(): SyncService {
    if (!SyncService.instance) {
      SyncService.instance = new SyncService();
    }
    return SyncService.instance;
  }

  private setupOnlineListener() {
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.syncPendingActions();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
    });
  }

  async syncPendingActions(): Promise<void> {
    if (this.syncInProgress || !this.isOnline) return;

    this.syncInProgress = true;

    try {
      const pendingActions = await getPendingActions();

      for (const action of pendingActions) {
        try {
          await this.executePendingAction(action);
          await removePendingAction(action.id);
        } catch (error) {
          console.error('Failed to sync action:', action, error);

          // Increment retry count
          if (action.retries < 3) {
            await updatePendingActionRetries(action.id, action.retries + 1);
          } else {
            // Remove after max retries
            await removePendingAction(action.id);
          }
        }
      }
    } catch (error) {
      console.error('Sync process failed:', error);
    } finally {
      this.syncInProgress = false;
    }
  }

  private async executePendingAction(action: any): Promise<void> {
    switch (action.type) {
      case 'mark_read':
        await api.markAnnouncementRead(action.data.announcement_id);
        break;

      case 'post_announcement':
        await api.postAnnouncement(action.data);
        break;

      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }
  }

  async addPendingAction(type: string, data: any): Promise<void> {
    // This will be handled by the offlineDB functions
    // Called from components when offline
  }

  // Register for background sync if supported
  registerBackgroundSync(): void {
    if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
      navigator.serviceWorker.ready.then((registration) => {
        registration.sync.register('background-sync').catch((error) => {
          console.log('Background sync not supported or failed to register:', error);
        });
      });
    }
  }

  // Listen for service worker messages
  setupServiceWorkerListener(): void {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'SYNC_PENDING_ACTIONS') {
          this.syncPendingActions();
        }
      });
    }
  }
}

export const syncService = SyncService.getInstance();
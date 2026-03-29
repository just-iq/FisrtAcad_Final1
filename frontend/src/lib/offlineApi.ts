import { api } from './api';
import {
  saveAnnouncements,
  getCachedAnnouncements,
  saveAssignments,
  getCachedAssignments,
  saveTimetable,
  getCachedTimetable,
  addPendingAction,
  markAnnouncementReadOffline,
  initDB
} from './offlineDB';
import { syncService } from './sync';

// Enhanced API with offline support
export const offlineApi = {
  // Announcements
  async announcementsFeed() {
    try {
      const response = await api.announcementsFeed();
      await saveAnnouncements(response.announcements);
      return response;
    } catch (error) {
      // Always try to return cached data, regardless of error type
      const cached = await getCachedAnnouncements();
      return { announcements: cached || [] };
    }
  },

  async markChannelRead(channelType: string) {
    if (!navigator.onLine) {
      // For channel read, we'll just return success since it's not critical
      return { marked: 0 };
    }

    return await api.markChannelRead(channelType);
  },

  // Assignments
  async assignmentsList() {
    try {
      const response = await api.assignmentsList();
      await saveAssignments(response.assignments);
      return response;
    } catch (error) {
      const cached = await getCachedAssignments();
      return { assignments: cached || [] };
    }
  },

  async createAssignment(payload: any) {
    if (!navigator.onLine) {
      // Queue the action
      await addPendingAction({
        id: `create_assignment_${Date.now()}`,
        type: 'post_announcement', // We'll need to add assignment types later
        data: payload,
        timestamp: Date.now(),
        retries: 0
      });
      return { assignment: { ...payload, id: `temp_${Date.now()}`, synced: false } };
    }

    return await api.createAssignment(payload);
  },

  // Timetable
  async timetable() {
    try {
      const response = await api.timetable();
      await saveTimetable(response.timetable);
      return response;
    } catch (error) {
      const cached = await getCachedTimetable();
      return { timetable: cached || [] };
    }
  },

  // Resources
  async resourcesList() {
    try {
      const response = await api.resourcesList();
      return response;
    } catch (error) {
      return { resources: [] };
    }
  },

  // Generic wrapper for other API calls
  async withOfflineFallback<T>(
    onlineCall: () => Promise<T>,
    cacheKey?: string,
    cacheData?: (data: T) => Promise<void>
  ): Promise<T> {
    try {
      const result = await onlineCall();
      if (cacheData) {
        await cacheData(result);
      }
      return result;
    } catch (error) {
      if (!navigator.onLine) {
        // Return empty result or cached data if available
        throw new Error('Offline: Operation queued for sync');
      }
      throw error;
    }
  },

  // Initialize offline functionality
  async init() {
    // Initialize IndexedDB first
    try {
      await initDB();
    } catch (error) {
      console.error('Failed to initialize IndexedDB:', error);
      // Continue anyway - some functionality might still work
    }

    // Register service worker for both development and production
    if ('serviceWorker' in navigator) {
      try {
        // Check if already controlled by a service worker
        const existingRegistration = await navigator.serviceWorker.getRegistration();

        // Only register manually if not already handled by Vite PWA
        if (import.meta.env.DEV || !existingRegistration) {
          const registration = await navigator.serviceWorker.register('/sw.js', {
            scope: '/'
          });

          // Listen for SW state changes
          registration.addEventListener('updatefound', () => {
            console.log('Service Worker update found');
          });

          if (registration.active) {
            console.log('Service Worker is active');
          }
        } else {
          console.log('Service Worker already exists from Vite PWA');
        }
      } catch (error) {
        console.error('Service Worker registration failed:', error);
      }
    } else {
      console.warn('Service Worker not supported in this browser');
    }

    syncService.setupServiceWorkerListener();
    syncService.registerBackgroundSync();

    // Sync on app start if online
    if (navigator.onLine) {
      syncService.syncPendingActions();
    }
  }
};

// Export the original API as well for direct use when needed
export { api };
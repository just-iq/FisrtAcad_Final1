import { api } from './api';
import {
  saveAnnouncements,
  getCachedAnnouncements,
  saveAssignments,
  getCachedAssignments,
  saveTimetable,
  getCachedTimetable,
  addPendingAction,
  markAnnouncementReadOffline
} from './offlineDB';
import { syncService } from './sync';

// Enhanced API with offline support
export const offlineApi = {
  // Announcements
  async announcementsFeed() {
    try {
      console.log('Fetching announcements online...');
      const response = await api.announcementsFeed();
      console.log('Caching announcements data:', response.announcements?.length, 'entries');
      await saveAnnouncements(response.announcements);
      return response;
    } catch (error) {
      console.log('Announcements fetch failed:', error.message);
      // Always try to return cached data, regardless of error type
      console.log('Returning cached announcements');
      const cached = await getCachedAnnouncements();
      console.log('Cached announcements:', cached?.length || 0);
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
      console.log('Fetching assignments online...');
      const response = await api.assignmentsList();
      console.log('Caching assignments data:', response.assignments?.length, 'entries');
      await saveAssignments(response.assignments);
      return response;
    } catch (error) {
      console.log('Assignments fetch failed:', error.message);
      // Always try to return cached data
      console.log('Returning cached assignments');
      const cached = await getCachedAssignments();
      console.log('Cached assignments:', cached?.length || 0);
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
      console.log('Fetching timetable online...');
      const response = await api.timetable();
      console.log('Caching timetable data:', response.timetable?.length, 'entries');
      await saveTimetable(response.timetable);
      return response;
    } catch (error) {
      console.log('Timetable fetch failed:', error.message);
      // Always try to return cached data
      console.log('Returning cached timetable');
      const cached = await getCachedTimetable();
      console.log('Cached timetable entries:', cached?.length || 0);
      return { timetable: cached || [] };
    }
  },

  // Resources
  async resourcesList() {
    try {
      console.log('Fetching resources online...');
      const response = await api.resourcesList();
      console.log('Resources data:', response.resources?.length, 'entries');
      // For now, resources don't need local caching as they're read-only
      return response;
    } catch (error) {
      console.log('Resources fetch failed:', error.message);
      // Resources are read-only, so we don't have offline fallback
      throw error;
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
    // Register service worker manually for development
    if ('serviceWorker' in navigator && import.meta.env.DEV) {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/'
        });
        console.log('Service Worker registered in development:', registration);
      } catch (error) {
        console.log('Service Worker registration failed:', error);
      }
    }

    syncService.setupServiceWorkerListener();
    syncService.registerBackgroundSync();

    // Sync on app start if online
    if (navigator.onLine) {
      console.log('Online - syncing pending actions...');
      syncService.syncPendingActions();
    }
  }
};

// Export the original API as well for direct use when needed
export { api };
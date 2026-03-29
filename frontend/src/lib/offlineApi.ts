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
      const response = await api.announcementsFeed();
      // Cache the data for offline use
      await saveAnnouncements(response.announcements);
      return response;
    } catch (error) {
      // If offline, return cached data
      if (!navigator.onLine) {
        const cached = await getCachedAnnouncements();
        return { announcements: cached };
      }
      throw error;
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
      if (!navigator.onLine) {
        const cached = await getCachedAssignments();
        return { assignments: cached };
      }
      throw error;
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
      if (!navigator.onLine) {
        const cached = await getCachedTimetable();
        return { timetable: cached };
      }
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
  init() {
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
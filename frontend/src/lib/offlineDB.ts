import { openDB, DBSchema, IDBPDatabase } from 'idb';

export interface OfflineData extends DBSchema {
  announcements: {
    key: string;
    value: {
      id: string;
      title: string;
      content: string;
      channel_type: string;
      created_at: string;
      updated_at: string;
      is_read?: boolean;
      synced: boolean;
    };
  };
  assignments: {
    key: string;
    value: {
      id: string;
      title: string;
      description: string;
      due_date: string;
      subject: string;
      created_at: string;
      synced: boolean;
    };
  };
  timetable: {
    key: string;
    value: {
      id: string;
      course: string;
      lecturer: string;
      day: string;
      start_time: string;
      end_time: string;
      location: string;
      synced: boolean;
    };
  };
  pendingActions: {
    key: string;
    value: {
      id: string;
      type: 'mark_read' | 'post_announcement' | 'update_assignment';
      data: any;
      timestamp: number;
      retries: number;
    };
  };
}

let db: IDBPDatabase<OfflineData> | null = null;

export async function initDB(): Promise<IDBPDatabase<OfflineData>> {
  if (db) return db;

  db = await openDB<OfflineData>('firstacad-offline', 1, {
    upgrade(db) {
      // Announcements store
      if (!db.objectStoreNames.contains('announcements')) {
        const announcementsStore = db.createObjectStore('announcements', {
          keyPath: 'id'
        });
        (announcementsStore as any).createIndex('channel_type', 'channel_type');
        (announcementsStore as any).createIndex('synced', 'synced');
      }

      // Assignments store
      if (!db.objectStoreNames.contains('assignments')) {
        const assignmentsStore = db.createObjectStore('assignments', {
          keyPath: 'id'
        });
        (assignmentsStore as any).createIndex('synced', 'synced');
      }

      // Timetable store
      if (!db.objectStoreNames.contains('timetable')) {
        const timetableStore = db.createObjectStore('timetable', {
          keyPath: 'id'
        });
        (timetableStore as any).createIndex('day', 'day');
        (timetableStore as any).createIndex('synced', 'synced');
      }

      // Pending actions store
      if (!db.objectStoreNames.contains('pendingActions')) {
        db.createObjectStore('pendingActions', {
          keyPath: 'id'
        });
      }
    },
  });

  return db;
}

// Generic CRUD operations
export async function saveToDB<T extends keyof OfflineData>(
  storeName: T,
  data: OfflineData[T]['value']
): Promise<void> {
  const database = await initDB();
  await database.put(storeName as any, data as any);
}

export async function getFromDB<T extends keyof OfflineData>(
  storeName: T,
  key: string
): Promise<OfflineData[T]['value'] | undefined> {
  const database = await initDB();
  return database.get(storeName as any, key as any) as any;
}

export async function getAllFromDB<T extends keyof OfflineData>(
  storeName: T
): Promise<OfflineData[T]['value'][]> {
  const database = await initDB();
  return database.getAll(storeName as any) as any;
}

export async function deleteFromDB<T extends keyof OfflineData>(
  storeName: T,
  key: string
): Promise<void> {
  const database = await initDB();
  await database.delete(storeName as any, key as any);
}

// Specific operations for announcements
export async function saveAnnouncements(announcements: any[]): Promise<void> {
  const database = await initDB();
  const tx = database.transaction('announcements', 'readwrite');

  for (const announcement of announcements) {
    await tx.store.put({
      ...announcement,
      synced: true,
      is_read: announcement.is_read || false
    });
  }

  await tx.done;
}

export async function getCachedAnnouncements(): Promise<any[]> {
  const database = await initDB();
  return database.getAll('announcements');
}

export async function markAnnouncementReadOffline(id: string): Promise<void> {
  const database = await initDB();
  const announcement = await database.get('announcements', id);

  if (announcement) {
    await database.put('announcements', {
      ...announcement,
      is_read: true,
      synced: false
    });

    // Add to pending actions
    await addPendingAction({
      id: `mark_read_${id}_${Date.now()}`,
      type: 'mark_read',
      data: { announcement_id: id },
      timestamp: Date.now(),
      retries: 0
    });
  }
}

export async function markChannelReadOffline(channelType: string): Promise<void> {
  const database = await initDB();
  const allAnnouncements = await getAllFromDB('announcements');

  const tx = database.transaction('announcements', 'readwrite');
  for (const announcement of allAnnouncements) {
    if (announcement.channel_type === channelType && !announcement.is_read) {
      await tx.store.put({
        ...announcement,
        is_read: true,
        synced: false
      });

      await addPendingAction({
        id: `mark_read_${announcement.id}_${Date.now()}`,
        type: 'mark_read',
        data: { announcement_id: announcement.id },
        timestamp: Date.now(),
        retries: 0
      });
    }
  }

  await tx.done;
}

// Specific operations for assignments
export async function saveAssignments(assignments: any[]): Promise<void> {
  const database = await initDB();
  const tx = database.transaction('assignments', 'readwrite');

  for (const assignment of assignments) {
    await tx.store.put({
      ...assignment,
      synced: true
    });
  }

  await tx.done;
}

export async function getCachedAssignments(): Promise<any[]> {
  const database = await initDB();
  return database.getAll('assignments');
}

// Specific operations for timetable
export async function saveTimetable(entries: any[]): Promise<void> {
  const database = await initDB();
  const tx = database.transaction('timetable', 'readwrite');

  for (const entry of entries) {
    await tx.store.put({
      ...entry,
      synced: true
    });
  }

  await tx.done;
}

export async function getCachedTimetable(): Promise<any[]> {
  const database = await initDB();
  return database.getAll('timetable');
}

// Pending actions management
export async function addPendingAction(action: OfflineData['pendingActions']['value']): Promise<void> {
  const database = await initDB();
  await database.put('pendingActions', action);
}

export async function getPendingActions(): Promise<OfflineData['pendingActions']['value'][]> {
  const database = await initDB();
  return database.getAll('pendingActions');
}

export async function removePendingAction(id: string): Promise<void> {
  const database = await initDB();
  await database.delete('pendingActions', id);
}

export async function updatePendingActionRetries(id: string, retries: number): Promise<void> {
  const database = await initDB();
  const action = await database.get('pendingActions', id);

  if (action) {
    await database.put('pendingActions', {
      ...action,
      retries
    });
  }
}

// Sync operations
export async function getUnsyncedData(): Promise<{
  announcements: any[];
  assignments: any[];
  timetable: any[];
}> {
  const database = await initDB();

  const [announcements, assignments, timetable] = await Promise.all([
    (database.getAllFromIndex as any)('announcements', 'synced', false),
    (database.getAllFromIndex as any)('assignments', 'synced', false),
    (database.getAllFromIndex as any)('timetable', 'synced', false)
  ]);

  return { announcements, assignments, timetable };
}

export async function markAsSynced(storeName: keyof OfflineData, ids: string[]): Promise<void> {
  const database = await initDB();
  const tx = (database.transaction as any)(storeName, 'readwrite');

  for (const id of ids) {
    const item = await tx.store.get(id);
    if (item) {
      await tx.store.put({
        ...item,
        synced: true
      });
    }
  }

  await tx.done;
}
# Offline Functionality

This application now supports comprehensive offline functionality, allowing users to continue using the app even without an internet connection.

## Features

### 1. **Offline Data Storage**
- Announcements, assignments, and timetable data are cached locally using IndexedDB
- Data is automatically synced when the user comes back online

### 2. **Offline Indicators**
- Visual indicators show when the app is offline
- Clear messaging about limited functionality when offline

### 3. **Background Sync**
- Actions performed offline (like marking announcements as read) are queued
- Automatically synced when connection is restored
- Service worker handles background synchronization

### 4. **Offline-First API**
- API calls automatically fall back to cached data when offline
- Critical actions are queued for later execution
- Seamless transition between online and offline states

## Technical Implementation

### Service Worker (`public/sw.js`)
- Uses Workbox for caching strategies
- Implements background sync for failed requests
- Handles push notifications

### IndexedDB Database (`src/lib/offlineDB.ts`)
- Stores announcements, assignments, and timetable data
- Manages pending actions queue
- Provides CRUD operations for offline data

### Sync Service (`src/lib/sync.ts`)
- Handles synchronization of pending actions
- Registers for background sync when supported
- Manages online/offline state transitions

### Offline API (`src/lib/offlineApi.ts`)
- Wraps existing API calls with offline support
- Automatically caches data and queues actions
- Provides fallback responses when offline

### UI Components
- `OfflineIndicator`: Shows offline status
- `OnlineIndicator`: Shows when back online
- `useOfflineCapabilities`: Hook for checking offline capabilities

## Usage

The offline functionality works automatically:

1. **First Visit**: Data is cached locally when fetched online
2. **Going Offline**: App continues to work with cached data
3. **Offline Actions**: Non-critical actions are queued for sync
4. **Coming Online**: Queued actions are automatically synced

## Browser Support

- Modern browsers with Service Worker and IndexedDB support
- Progressive Web App (PWA) capabilities
- Background sync requires supporting browsers (Chrome, Edge, etc.)

## Testing Offline Mode

To test offline functionality:

1. Open the app in a browser
2. Open Developer Tools → Network tab
3. Check "Offline" to simulate no internet connection
4. Try navigating and using the app
5. Uncheck "Offline" to restore connection and see sync in action
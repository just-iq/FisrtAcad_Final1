type ApiError = { error?: { code?: string; message?: string } };

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";

export function getToken(): string | null {
  return localStorage.getItem("access_token");
}

export function setToken(token: string) {
  localStorage.setItem("access_token", token);
}

export function clearToken() {
  localStorage.removeItem("access_token");
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers = new Headers(init.headers || {});
  if (!headers.has("content-type") && !(init.body instanceof FormData)) {
    headers.set("content-type", "application/json");
  }
  if (token) headers.set("authorization", `Bearer ${token}`);

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  if (!res.ok) {
    if (res.status === 401) {
      // Hard fail for now (no refresh tokens implemented on backend yet).
      localStorage.removeItem("access_token");
      localStorage.removeItem("auth_user");
      localStorage.removeItem("currentRole");
      // Avoid react-router dependency in lib
      window.location.href = "/login";
    }
    let payload: ApiError | undefined;
    try {
      payload = (await res.json()) as ApiError;
    } catch {
      // ignore
    }
    const msg = payload?.error?.message || `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return (await res.json()) as T;
}

export const api = {
  login: (email: string, password: string) =>
    request<{ access_token: string; user: any }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  usersList: () => request<{ users: any[] }>("/api/users"),
  userUpdate: (id: string, payload: any) =>
    request<{ user: any }>(`/api/users/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  // Public Signup (Student)
  signup: (payload: any) =>
    request<{ id: string }>("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  // Admin-only user creation (maps to POST /api/auth/register)
  createUser: (payload: any) =>
    request<{ id: string }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  
  // Public Academic Data
  getDepartments: () => request<{ departments: { id: string; name: string }[] }>("/api/academic/departments"),
  getLevels: () => request<{ levels: { id: string; name: string; order: number }[] }>("/api/academic/levels"),
  getGroups: (params?: { department_id?: string; level_id?: string }) => {
    const qs = new URLSearchParams();
    if (params?.department_id) qs.set("department_id", params.department_id);
    if (params?.level_id) qs.set("level_id", params.level_id);
    const q = qs.toString();
    return request<{ groups: { id: string; name: string }[] }>(`/api/academic/groups${q ? `?${q}` : ""}`);
  },

  announcementsFeed: () =>
    request<{ announcements: any[] }>("/api/announcements/feed"),
  // Admin-only: view ALL announcements across all channels
  announcementsAudit: () =>
    request<{ announcements: any[] }>("/api/audit"),
  postAnnouncement: (payload: any) =>
    request<{ announcement: any }>("/api/announcements", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  markAnnouncementRead: (id: string) =>
    request<{ ok: boolean }>(`/api/interactions/announcements/${id}/read`, { method: "POST" }),
  markChannelRead: (channelType: string) =>
    request<{ marked: number }>(`/api/interactions/announcements/read-channel`, { 
      method: "POST",
      body: JSON.stringify({ channel_type: channelType })
    }),
  announcementUnreadCounts: () =>
    request<{ counts: { channel_type: string; count: number }[] }>("/api/interactions/announcements/unread-counts"),

  messagesList: () => request<{ messages: any[] }>("/api/messages"),
  sendMessage: (payload: any) =>
    request<{ message: any }>("/api/messages", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  timetable: () => request<{ timetable: any[] }>("/api/timetable"),
  createTimetableEntry: (payload: any) =>
    request<{ entry: any }>("/api/timetable", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  deleteTimetableEntry: (id: string) =>
    request<{ message: string }>(`/api/timetable/${id}`, { method: "DELETE" }),
  updateTimetableEntry: (id: string, payload: any) =>
    request<{ entry: any }>(`/api/timetable/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  assignmentsList: () => request<{ assignments: any[] }>("/api/assignments"),
  createAssignment: (payload: any) =>
    request<{ assignment: any }>("/api/assignments", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  submitAssignment: (assignmentId: string, formData: FormData) =>
    request<{ submission: any }>(
      `/api/assignments/${assignmentId}/submissions`,
      {
        method: "POST",
        body: formData,
      },
    ),

  resourcesList: () => request<{ resources: any[] }>("/api/resources"),
  getResource: (id: string) => request<{ resource: any }>(`/api/resources/${id}`),
  createResource: (formData: FormData) =>
    request<{ resource: any }>("/api/resources", {
      method: "POST",
      body: formData,
    }),
  
  // Assignment submissions for lecturer
  listAssignmentSubmissions: (assignmentId: string) =>
    request<{ submissions: any[] }>(`/api/assignments/${assignmentId}/submissions`),

  recommendResources: (studentId: string) =>
    request<any>(`/api/recommend/resources/${studentId}`),

  // Events
  listEvents: (departmentId?: string) => 
    request<{ events: any[] }>(`/api/events${departmentId ? `?department_id=${departmentId}` : ''}`),
  createEvent: (payload: any) =>
    request<{ event: any }>("/api/events", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  // Personalized Notifications
  notificationsList: (params?: { unreadOnly?: boolean; limit?: number }) => 
    request<{ notifications: any[] }>(`/api/notifications${params?.unreadOnly ? '?unreadOnly=true' : ''}`),
  notificationsUnreadCount: () => 
    request<{ count: number }>("/api/notifications/unread-count"),
  markNotificationRead: (id: string) =>
    request<{ notification: any }>(`/api/notifications/${id}/read`, { method: "POST" }),
  markAllNotificationsRead: () =>
    request<{ marked: number }>("/api/notifications/read-all", { method: "POST" }),
  generateNotifications: () =>
    request<{ classRemindersCreated: number; assignmentRemindersCreated: number }>("/api/notifications/generate", { method: "POST" }),

  // Direct Messages
  dmConversations: () => 
    request<{ conversations: any[] }>("/api/dm/conversations"),
  dmConversation: (userId: string) => 
    request<{ messages: any[]; otherUser: any }>(`/api/dm/conversations/${userId}`),
  sendDM: (payload: { receiver_id: string; body: string }) =>
    request<{ message: any }>("/api/dm", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  markDMRead: (messageId: string) =>
    request<{ message: any }>(`/api/dm/${messageId}/read`, { method: "POST" }),
  dmUnreadCount: () =>
    request<{ count: number }>("/api/dm/unread-count"),

  // Web Push
  getVapidPublicKey: () =>
    request<{ key: string | null }>("/api/push/vapid-public-key"),
  savePushSubscription: (subscription: object) =>
    request<{ ok: boolean }>("/api/push/subscribe", {
      method: "POST",
      body: JSON.stringify(subscription),
    }),
  dmRecipients: (search?: string) =>
    request<{ recipients: any[] }>(`/api/dm/recipients${search ? `?search=${encodeURIComponent(search)}` : ""}`),
};

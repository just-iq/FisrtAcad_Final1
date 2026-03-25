export type UserRole = 'admin' | 'lecturer' | 'student_executive' | 'course_rep' | 'student';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  department?: string;
  avatar?: string;
}

export type AnnouncementLevel = 'school' | 'department' | 'group';
export type AnnouncementPriority = 'high' | 'medium' | 'low';

export interface Announcement {
  id: string;
  title: string;
  content: string;
  summary?: string; // AI-generated summary placeholder
  source: string;
  sourceRole: UserRole;
  level: AnnouncementLevel;
  priority: AnnouncementPriority;
  timestamp: Date;
  department?: string;
}

export interface TimetableEntry {
  id: string;
  courseCode: string;
  courseName: string;
  lecturer: string;
  room: string;
  day: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday';
  startTime: string;
  endTime: string;
}

export type AssignmentStatus = 'pending' | 'submitted' | 'graded' | 'overdue' | 'missed';

export interface Assignment {
  id: string;
  title: string;
  courseCode: string;
  courseName: string;
  dueDate: Date;
  status: AssignmentStatus;
  allowResubmission: boolean;
  description?: string;
}

export interface Resource {
  id: string;
  title: string;
  type: 'pdf' | 'slides' | 'document' | 'video';
  courseCode: string;
  uploadedBy: string;
  uploadedAt: Date;
  size: string;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'announcement' | 'assignment' | 'timetable' | 'system';
  read: boolean;
  timestamp: Date;
}

/**
 * Type definitions for Course Management features
 */

export interface Folder {
  id: string;
  user_id: string;
  name: string;
  color: string;
  icon: string;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface FolderCourse {
  id: string;
  folder_id: string;
  course_id: string;
  position: number;
  added_at: string;
}

export interface Course {
  id: string;
  user_id: string;
  title: string;
  editable_title?: string | null;
  created_at: string;
  updated_at: string;
  file_url?: string | null;
  file_name?: string | null;
  processing_status: 'pending' | 'processing' | 'completed' | 'failed';
  error_message?: string | null;
}

export interface FolderWithCourses extends Folder {
  courses: Course[];
  course_count: number;
}

export interface CourseWithFolder extends Course {
  folder?: {
    id: string;
    name: string;
    color: string;
    icon: string;
  } | null;
}

// API Response Types
export interface DeleteCourseResponse {
  success: boolean;
  error?: string;
}

export interface RenameCourseResponse {
  success: boolean;
  course?: Course;
  error?: string;
}

export interface CreateFolderResponse {
  success: boolean;
  folder?: Folder;
  error?: string;
}

export interface AddCourseToFolderResponse {
  success: boolean;
  folder_course?: FolderCourse;
  error?: string;
}

export interface GetFoldersResponse {
  success: boolean;
  folders?: FolderWithCourses[];
  error?: string;
}

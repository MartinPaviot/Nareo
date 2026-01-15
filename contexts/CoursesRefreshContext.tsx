'use client';

import { createContext, useContext, useCallback, useRef } from 'react';

type RefreshCallback = () => void;
type RemoveCourseCallback = (courseId: string) => void;

interface CoursesRefreshContextType {
  subscribe: (callback: RefreshCallback) => () => void;
  subscribeToRemove: (callback: RemoveCourseCallback) => () => void;
  triggerRefresh: () => void;
  removeCourse: (courseId: string) => void;
}

const CoursesRefreshContext = createContext<CoursesRefreshContextType | null>(null);

export function CoursesRefreshProvider({ children }: { children: React.ReactNode }) {
  const subscribersRef = useRef<Set<RefreshCallback>>(new Set());
  const removeSubscribersRef = useRef<Set<RemoveCourseCallback>>(new Set());

  const subscribe = useCallback((callback: RefreshCallback) => {
    subscribersRef.current.add(callback);
    return () => {
      subscribersRef.current.delete(callback);
    };
  }, []);

  const subscribeToRemove = useCallback((callback: RemoveCourseCallback) => {
    removeSubscribersRef.current.add(callback);
    return () => {
      removeSubscribersRef.current.delete(callback);
    };
  }, []);

  const triggerRefresh = useCallback(() => {
    subscribersRef.current.forEach(callback => callback());
  }, []);

  const removeCourse = useCallback((courseId: string) => {
    removeSubscribersRef.current.forEach(callback => callback(courseId));
  }, []);

  return (
    <CoursesRefreshContext.Provider value={{ subscribe, subscribeToRemove, triggerRefresh, removeCourse }}>
      {children}
    </CoursesRefreshContext.Provider>
  );
}

export function useCoursesRefresh() {
  const context = useContext(CoursesRefreshContext);
  if (!context) {
    // Return no-op functions if not in provider (for SSR or outside dashboard)
    return {
      subscribe: () => () => {},
      subscribeToRemove: () => () => {},
      triggerRefresh: () => {},
      removeCourse: () => {},
    };
  }
  return context;
}

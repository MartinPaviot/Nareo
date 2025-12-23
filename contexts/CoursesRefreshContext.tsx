'use client';

import { createContext, useContext, useCallback, useRef } from 'react';

type RefreshCallback = () => void;

interface CoursesRefreshContextType {
  subscribe: (callback: RefreshCallback) => () => void;
  triggerRefresh: () => void;
}

const CoursesRefreshContext = createContext<CoursesRefreshContextType | null>(null);

export function CoursesRefreshProvider({ children }: { children: React.ReactNode }) {
  const subscribersRef = useRef<Set<RefreshCallback>>(new Set());

  const subscribe = useCallback((callback: RefreshCallback) => {
    subscribersRef.current.add(callback);
    return () => {
      subscribersRef.current.delete(callback);
    };
  }, []);

  const triggerRefresh = useCallback(() => {
    subscribersRef.current.forEach(callback => callback());
  }, []);

  return (
    <CoursesRefreshContext.Provider value={{ subscribe, triggerRefresh }}>
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
      triggerRefresh: () => {},
    };
  }
  return context;
}

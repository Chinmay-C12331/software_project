import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  api,
  ConfirmationReceipt,
  getStoredToken,
  registerUnauthorizedHandler,
  setStoredToken,
  Student,
} from '../api.ts';

export interface ToastMessage {
  id: string;
  type: 'success' | 'warning' | 'error' | 'info';
  title: string;
  message?: string;
}

interface RegistrationContextValue {
  student: Student | null;
  loadingAuth: boolean;
  selectedCourseIds: number[];
  waitlistCourseIds: number[];
  lastConfirmation: ConfirmationReceipt | null;
  toasts: ToastMessage[];
  login: (token: string, studentData: Student) => void;
  logout: () => void;
  refreshStudent: () => Promise<void>;
  toggleCourseSelection: (courseId: number) => void;
  removeCourseFromSelection: (courseId: number) => void;
  setCourseSelectionBulk: (courseIds: number[]) => void;
  toggleWaitlistSelection: (courseId: number) => void;
  moveCourseToWaitlistSelection: (courseId: number) => void;
  clearSelections: () => void;
  setLastConfirmation: (receipt: ConfirmationReceipt | null) => void;
  addToast: (type: ToastMessage['type'], title: string, message?: string) => void;
  dismissToast: (id: string) => void;
}

const RegistrationContext = createContext<RegistrationContextValue | undefined>(undefined);

const SELECTED_COURSES_KEY = 'ccrs_selected_courses';
const WAITLIST_COURSES_KEY = 'ccrs_waitlist_courses';
const LAST_CONFIRMATION_KEY = 'ccrs_last_confirmation';

export const RegistrationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [student, setStudent] = useState<Student | null>(null);
  const [loadingAuth, setLoadingAuth] = useState<boolean>(true);
  const [selectedCourseIds, setSelectedCourseIds] = useState<number[]>(() => {
    try {
      const saved = sessionStorage.getItem(SELECTED_COURSES_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [waitlistCourseIds, setWaitlistCourseIds] = useState<number[]>(() => {
    try {
      const saved = sessionStorage.getItem(WAITLIST_COURSES_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [lastConfirmation, setLastConfirmationState] = useState<ConfirmationReceipt | null>(() => {
    try {
      const saved = sessionStorage.getItem(LAST_CONFIRMATION_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (type: ToastMessage['type'], title: string, message?: string) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev, { id, type, title, message }]);
      setTimeout(() => {
        dismissToast(id);
      }, 4500);
    },
    [dismissToast]
  );

  const clearSelections = useCallback(() => {
    setSelectedCourseIds([]);
    setWaitlistCourseIds([]);
    sessionStorage.removeItem(SELECTED_COURSES_KEY);
    sessionStorage.removeItem(WAITLIST_COURSES_KEY);
  }, []);

  const setLastConfirmation = useCallback((receipt: ConfirmationReceipt | null) => {
    setLastConfirmationState(receipt);
    if (receipt) {
      sessionStorage.setItem(LAST_CONFIRMATION_KEY, JSON.stringify(receipt));
    } else {
      sessionStorage.removeItem(LAST_CONFIRMATION_KEY);
    }
  }, []);

  const logout = useCallback(() => {
    setStoredToken(null);
    setStudent(null);
    clearSelections();
    setLastConfirmation(null);
  }, [clearSelections, setLastConfirmation]);

  const refreshStudent = useCallback(async () => {
    const token = getStoredToken();
    if (!token) {
      setStudent(null);
      setLoadingAuth(false);
      return;
    }
    try {
      const res = await api.get('/auth/me');
      setStudent(res.data.student);
    } catch {
      setStoredToken(null);
      setStudent(null);
    } finally {
      setLoadingAuth(false);
    }
  }, []);

  useEffect(() => {
    registerUnauthorizedHandler(() => {
      logout();
      addToast('warning', 'Session Expired', 'Please sign in again to continue.');
    });
    refreshStudent();
  }, [logout, refreshStudent, addToast]);

  useEffect(() => {
    sessionStorage.setItem(SELECTED_COURSES_KEY, JSON.stringify(selectedCourseIds));
  }, [selectedCourseIds]);

  useEffect(() => {
    sessionStorage.setItem(WAITLIST_COURSES_KEY, JSON.stringify(waitlistCourseIds));
  }, [waitlistCourseIds]);

  const login = useCallback(
    (token: string, studentData: Student) => {
      setStoredToken(token);
      setStudent(studentData);
      clearSelections();
    },
    [clearSelections]
  );

  const toggleCourseSelection = useCallback((courseId: number) => {
    setSelectedCourseIds((prev) =>
      prev.includes(courseId) ? prev.filter((id) => id !== courseId) : [...prev, courseId]
    );
    setWaitlistCourseIds((prev) => prev.filter((id) => id !== courseId));
  }, []);

  const removeCourseFromSelection = useCallback((courseId: number) => {
    setSelectedCourseIds((prev) => prev.filter((id) => id !== courseId));
    setWaitlistCourseIds((prev) => prev.filter((id) => id !== courseId));
  }, []);

  const setCourseSelectionBulk = useCallback((courseIds: number[]) => {
    setSelectedCourseIds(Array.from(new Set(courseIds)));
  }, []);

  const toggleWaitlistSelection = useCallback((courseId: number) => {
    setWaitlistCourseIds((prev) =>
      prev.includes(courseId) ? prev.filter((id) => id !== courseId) : [...prev, courseId]
    );
    setSelectedCourseIds((prev) => prev.filter((id) => id !== courseId));
  }, []);

  const moveCourseToWaitlistSelection = useCallback((courseId: number) => {
    setSelectedCourseIds((prev) => prev.filter((id) => id !== courseId));
    setWaitlistCourseIds((prev) => (prev.includes(courseId) ? prev : [...prev, courseId]));
  }, []);

  return (
    <RegistrationContext.Provider
      value={{
        student,
        loadingAuth,
        selectedCourseIds,
        waitlistCourseIds,
        lastConfirmation,
        toasts,
        login,
        logout,
        refreshStudent,
        toggleCourseSelection,
        removeCourseFromSelection,
        setCourseSelectionBulk,
        toggleWaitlistSelection,
        moveCourseToWaitlistSelection,
        clearSelections,
        setLastConfirmation,
        addToast,
        dismissToast,
      }}
    >
      {children}
    </RegistrationContext.Provider>
  );
};

export function useRegistration() {
  const ctx = useContext(RegistrationContext);
  if (!ctx) {
    throw new Error('useRegistration must be used within a RegistrationProvider');
  }
  return ctx;
}

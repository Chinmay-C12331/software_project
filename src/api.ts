import axios from 'axios';

export interface Student {
  id: number;
  student_code: string;
  name: string;
  email: string;
  department: string;
  semester: number;
  credit_limit: number;
  registeredCredits?: number;
}

export interface PrerequisiteItem {
  id: number;
  code: string;
  name: string;
  completed: boolean;
}

export interface Course {
  id: number;
  code: string;
  name: string;
  credits: number;
  faculty: string;
  department: string;
  schedule: string;
  total_seats: number;
  available_seats: number;
  semester: number;
  prerequisites: PrerequisiteItem[];
  prerequisitesPassed: boolean;
  missingPrerequisites: PrerequisiteItem[];
  isRegistered: boolean;
  isWaitlisted: boolean;
  waitlistId: number | null;
  waitlistPosition: number | null;
  totalWaitlisted: number;
  eligibilityStatus: 'ELIGIBLE' | 'PREREQUISITE_MISSING' | 'FULL_WAITLIST_AVAILABLE' | 'REGISTERED';
}

export interface ValidationCourseResult {
  courseId: number;
  code: string;
  name: string;
  credits: number;
  faculty: string;
  department: string;
  schedule: string;
  prerequisites: {
    passed: boolean;
    items: PrerequisiteItem[];
    missing: PrerequisiteItem[];
  };
  seats: {
    available: number;
    total: number;
    full: boolean;
    currentWaitlistSize: number;
  };
  alreadyRegistered: boolean;
  alreadyWaitlisted: boolean;
  status: 'ELIGIBLE' | 'PREREQUISITE_MISSING' | 'FULL_WAITLIST_AVAILABLE' | 'ALREADY_REGISTERED';
}

export interface ValidationResponse {
  courses: ValidationCourseResult[];
  creditCheck: {
    currentRegisteredCredits: number;
    selectedEligibleCredits: number;
    total: number;
    limit: number;
    remaining: number;
    exceeded: boolean;
  };
  valid: boolean;
}

export interface ConfirmationReceipt {
  registration: {
    id: number;
    registration_code: string;
    created_at: string;
    total_credits: number;
  };
  registeredCourses: Array<{
    id: number;
    code: string;
    name: string;
    credits: number;
    faculty: string;
    department: string;
    schedule: string;
    total_seats: number;
    available_seats: number;
    semester: number;
  }>;
  waitlistedCourses: Array<{
    waitlistId: number;
    courseId: number;
    code: string;
    name: string;
    credits: number;
    faculty: string;
    schedule: string;
    position: number;
  }>;
  totalRegisteredCredits: number;
  batchCredits: number;
  student: Student;
}

const TOKEN_STORAGE_KEY = 'ccrs_jwt_token';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setStoredToken(token: string | null): void {
  if (token) {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  }
}

export const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = getStoredToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let unauthorizedHandler: (() => void) | null = null;

export function registerUnauthorizedHandler(fn: () => void) {
  unauthorizedHandler = fn;
}

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !error.config?.url?.includes('/auth/login')) {
      setStoredToken(null);
      if (unauthorizedHandler) {
        unauthorizedHandler();
      }
    }
    return Promise.reject(error);
  }
);

import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Info,
  LogOut,
  X,
} from 'lucide-react';
import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useRegistration } from '../context/RegistrationContext.tsx';

const STEPS = [
  { number: 1, label: 'Login', path: '/login' },
  { number: 2, label: 'Browse', path: '/catalog' },
  { number: 3, label: 'Review', path: '/review' },
  { number: 4, label: 'Confirm', path: '/confirm' },
  { number: 5, label: 'Done', path: '/done' },
];

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { student, logout, toasts, dismissToast, selectedCourseIds, waitlistCourseIds } =
    useRegistration();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getActiveStepIndex = () => {
    if (location.pathname === '/login') return 0;
    if (location.pathname === '/catalog') return 1;
    if (location.pathname === '/review') return 2;
    if (location.pathname === '/confirm') return 3;
    if (location.pathname === '/done') return 4;
    return -1;
  };

  const activeStep = getActiveStepIndex();
  const totalSelectedCount = selectedCourseIds.length + waitlistCourseIds.length;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Toast Notifications */}
      <div
        aria-live="polite"
        className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-xs w-full pointer-events-none px-4 sm:px-0 no-print"
      >
        {toasts.map((toast) => {
          const borderAndBg =
            toast.type === 'success'
              ? 'bg-white border-emerald-500'
              : toast.type === 'warning'
              ? 'bg-white border-amber-500'
              : toast.type === 'error'
              ? 'bg-white border-red-500'
              : 'bg-white border-slate-300';

          const IconComponent =
            toast.type === 'success'
              ? CheckCircle2
              : toast.type === 'warning'
              ? AlertTriangle
              : toast.type === 'error'
              ? AlertCircle
              : Info;

          const iconColor =
            toast.type === 'success'
              ? 'text-emerald-600'
              : toast.type === 'warning'
              ? 'text-amber-600'
              : toast.type === 'error'
              ? 'text-red-600'
              : 'text-[#1E3A8A]';

          return (
            <div
              key={toast.id}
              role="status"
              className={`pointer-events-auto flex items-start gap-2 p-3 rounded-lg border shadow-sm text-xs ${borderAndBg}`}
            >
              <IconComponent className={`w-4 h-4 shrink-0 mt-0.5 ${iconColor}`} />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-900">{toast.title}</p>
                {toast.message && <p className="text-slate-500 mt-0.5">{toast.message}</p>}
              </div>
              <button
                type="button"
                onClick={() => dismissToast(toast.id)}
                aria-label="Close"
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Header with Student Name / ID / Department / Semester and Logout */}
      {student && (
        <header className="bg-[#1E3A8A] text-white no-print">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
            <Link to="/catalog" className="text-sm sm:text-base font-bold text-white whitespace-nowrap">
              Course Registration
            </Link>

            <nav aria-label="Main navigation" className="flex items-center gap-4 text-xs font-medium">
              <Link
                to="/catalog"
                className={
                  location.pathname === '/catalog'
                    ? 'text-teal-300 font-semibold'
                    : 'text-blue-100 hover:text-white'
                }
              >
                Catalog
              </Link>
              <Link
                to="/my-registrations"
                className={
                  location.pathname === '/my-registrations'
                    ? 'text-teal-300 font-semibold'
                    : 'text-blue-100 hover:text-white'
                }
              >
                My Registrations
              </Link>
              <Link
                to="/academic-record"
                className={
                  location.pathname === '/academic-record'
                    ? 'text-teal-300 font-semibold'
                    : 'text-blue-100 hover:text-white'
                }
              >
                Academic Record
              </Link>
            </nav>

            <div className="flex items-center gap-3 shrink-0">
              <div className="hidden md:flex items-center gap-1.5 text-xs text-blue-100">
                <span className="font-semibold text-white">{student.name}</span>
                <span>·</span>
                <span className="font-mono text-teal-300">{student.student_code}</span>
                <span>·</span>
                <span>{student.department}</span>
                <span>·</span>
                <span>Sem {student.semester}</span>
              </div>

              <button
                type="button"
                onClick={handleLogout}
                aria-label="Logout"
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-white bg-blue-950/60 hover:bg-blue-950 rounded-md transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </header>
      )}

      {/* Stepper: Login > Browse > Review > Confirm > Done */}
      {student && activeStep >= 1 && (
        <div className="bg-white border-b border-slate-200 no-print">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-2">
            <ol aria-label="Registration Steps" className="flex items-center gap-2 text-xs">
              {STEPS.map((step, index) => {
                const isCompleted = index < activeStep;
                const isCurrent = index === activeStep;
                const isClickable =
                  (index === 1 && activeStep !== 1) ||
                  (index === 2 && totalSelectedCount > 0) ||
                  (index === 3 && activeStep >= 3);

                return (
                  <li key={step.label} className="flex items-center gap-1.5">
                    {isClickable ? (
                      <button
                        type="button"
                        onClick={() => navigate(step.path)}
                        className="inline-flex items-center gap-1 cursor-pointer"
                      >
                        <span
                          className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-mono font-bold ${
                            isCompleted
                              ? 'bg-emerald-600 text-white'
                              : isCurrent
                              ? 'bg-[#1E3A8A] text-white'
                              : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          {isCompleted ? '✓' : step.number}
                        </span>
                        <span className={isCurrent ? 'text-[#1E3A8A] font-bold' : 'text-slate-600'}>
                          {step.label}
                        </span>
                      </button>
                    ) : (
                      <span className="inline-flex items-center gap-1">
                        <span
                          className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-mono font-bold ${
                            isCompleted
                              ? 'bg-emerald-600 text-white'
                              : isCurrent
                              ? 'bg-[#1E3A8A] text-white'
                              : 'bg-slate-100 text-slate-400'
                          }`}
                        >
                          {isCompleted ? '✓' : step.number}
                        </span>
                        <span className={isCurrent ? 'text-[#1E3A8A] font-bold' : 'text-slate-400'}>
                          {step.label}
                        </span>
                      </span>
                    )}
                    {index < STEPS.length - 1 && (
                      <ChevronRight className="w-3.5 h-3.5 text-slate-300" aria-hidden="true" />
                    )}
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      )}

      <main className="flex-1">{children}</main>

      <footer className="bg-white border-t border-slate-200 py-3 px-4 text-center text-xs text-slate-500 mt-auto no-print">
        Team-7 | College Course Registration System
      </footer>
    </div>
  );
};

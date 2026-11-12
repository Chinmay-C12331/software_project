import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Loader2,
  Trash2,
  XCircle,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ValidationResponse } from '../api.ts';
import { Layout } from '../components/Layout.tsx';
import { useRegistration } from '../context/RegistrationContext.tsx';

export const ReviewPage: React.FC = () => {
  const {
    selectedCourseIds,
    waitlistCourseIds,
    removeCourseFromSelection,
    moveCourseToWaitlistSelection,
    addToast,
  } = useRegistration();
  const navigate = useNavigate();

  const [validation, setValidation] = useState<ValidationResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const allCombinedIds = Array.from(new Set([...selectedCourseIds, ...waitlistCourseIds]));

  const runServerValidation = useCallback(async () => {
    if (allCombinedIds.length === 0) {
      setValidation(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/registration/validate', {
        courseIds: allCombinedIds,
      });
      setValidation(res.data);

      for (const item of res.data.courses) {
        if (item.status === 'FULL_WAITLIST_AVAILABLE' && selectedCourseIds.includes(item.courseId)) {
          moveCourseToWaitlistSelection(item.courseId);
        }
      }
    } catch (err: any) {
      addToast('error', err.response?.data?.error?.message || 'Validation failed');
    } finally {
      setLoading(false);
    }
  }, [allCombinedIds.join(','), addToast, moveCourseToWaitlistSelection, selectedCourseIds]);

  useEffect(() => {
    runServerValidation();
  }, [runServerValidation]);

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold text-slate-900">Review &amp; Validation</h1>
          <button
            type="button"
            onClick={() => navigate('/catalog')}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back</span>
          </button>
        </div>

        {loading ? (
          <div className="bg-white rounded-xl border border-slate-200 p-10 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-[#1E3A8A]" />
          </div>
        ) : !validation || validation.courses.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-xs text-slate-500">
            No courses selected.
          </div>
        ) : (
          <>
            {validation.creditCheck.exceeded && (
              <div
                role="alert"
                className="p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-center gap-2.5 text-xs font-semibold text-red-800"
              >
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span>
                  Credit limit exceeded ({validation.creditCheck.total} / {validation.creditCheck.limit}). Remove courses to proceed.
                </span>
              </div>
            )}

            <div className="bg-white rounded-xl border border-slate-200 p-3.5 flex items-center justify-between text-xs">
              <div>
                <span className="text-slate-500">Total Credits: </span>
                <span
                  className={`font-mono font-bold ${
                    validation.creditCheck.exceeded ? 'text-red-600' : 'text-emerald-700'
                  }`}
                >
                  {validation.creditCheck.total} / {validation.creditCheck.limit}
                </span>
              </div>
              <div>
                <span className="text-slate-500">Remaining Credits: </span>
                <span className="font-mono font-bold text-slate-800">
                  {validation.creditCheck.remaining}
                </span>
              </div>
            </div>

            <div className="space-y-3">
              {validation.courses.map((item) => {
                const isEligible = item.status === 'ELIGIBLE';
                const isWaitlist = item.status === 'FULL_WAITLIST_AVAILABLE';
                const isBlocked = !isEligible && !isWaitlist;

                return (
                  <div key={item.courseId} className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <span className="font-mono text-xs font-bold text-[#1E3A8A]">{item.code}</span>
                        <span className="mx-1.5 text-slate-300">·</span>
                        <span className="text-sm font-bold text-slate-900">{item.name}</span>
                        <span className="ml-2 text-xs font-mono text-slate-500">({item.credits} Cr)</span>
                      </div>

                      <div className="flex items-center gap-2">
                        {isEligible && (
                          <span className="px-2 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Eligible
                          </span>
                        )}
                        {isWaitlist && (
                          <span className="px-2 py-0.5 rounded text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            Waitlist
                          </span>
                        )}
                        {isBlocked && (
                          <span className="px-2 py-0.5 rounded text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
                            Blocked
                          </span>
                        )}

                        <button
                          type="button"
                          onClick={() => removeCourseFromSelection(item.courseId)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 rounded cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Remove</span>
                        </button>
                      </div>
                    </div>

                    {/* Three Check Rows: Prerequisites, Seats, Credit Limit */}
                    <div className="border-t border-slate-100 pt-2.5 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Prerequisites</span>
                        {item.prerequisites.passed ? (
                          <span className="text-emerald-700 font-medium inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Completed
                          </span>
                        ) : (
                          <span className="text-red-600 font-medium inline-flex items-center gap-1">
                            <XCircle className="w-3.5 h-3.5" /> Missing{' '}
                            {item.prerequisites.missing.map((m) => m.code).join(', ')}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Seats</span>
                        {!item.seats.full ? (
                          <span className="text-emerald-700 font-mono font-medium inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> {item.seats.available} / {item.seats.total}
                          </span>
                        ) : (
                          <span className="text-amber-700 font-mono font-medium inline-flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5" /> Full (Waitlist)
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Credit limit</span>
                        {!validation.creditCheck.exceeded ? (
                          <span className="text-emerald-700 font-mono font-medium inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> {validation.creditCheck.total} / 24
                          </span>
                        ) : (
                          <span className="text-red-600 font-mono font-medium inline-flex items-center gap-1">
                            <XCircle className="w-3.5 h-3.5" /> Exceeded ({validation.creditCheck.total} / 24)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                disabled={!validation.valid}
                onClick={() => navigate('/confirm')}
                className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-[#1E3A8A] hover:bg-blue-900 disabled:bg-slate-200 disabled:text-slate-400 rounded-lg transition-colors cursor-pointer"
              >
                <span>Proceed</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
};

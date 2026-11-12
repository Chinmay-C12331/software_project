import { Loader2, Trash2 } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../api.ts';
import { Layout } from '../components/Layout.tsx';
import { useRegistration } from '../context/RegistrationContext.tsx';

interface RegisteredCourseItem {
  id: number;
  code: string;
  name: string;
  credits: number;
  faculty: string;
  schedule: string;
}

interface WaitlistItem {
  id: number;
  position: number;
  status: 'WAITING' | 'PROMOTED';
  code: string;
  name: string;
  credits: number;
}

export const MyRegistrationsPage: React.FC = () => {
  const { addToast, refreshStudent } = useRegistration();

  const [registeredCourses, setRegisteredCourses] = useState<RegisteredCourseItem[]>([]);
  const [waitlistEntries, setWaitlistEntries] = useState<WaitlistItem[]>([]);
  const [totalCredits, setTotalCredits] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [regRes, wlRes] = await Promise.all([
        api.get('/registration/my'),
        api.get('/waitlist/my'),
      ]);
      setRegisteredCourses(regRes.data.registeredCourses);
      setTotalCredits(regRes.data.totalCredits);
      setWaitlistEntries(wlRes.data.waitlist);
    } catch {
      addToast('error', 'Failed to load registrations');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleDropCourse = async (courseId: number) => {
    try {
      const res = await api.delete(`/registration/course/${courseId}`);
      addToast('success', res.data.message);
      await Promise.all([fetchAll(), refreshStudent()]);
    } catch (err: any) {
      addToast('error', err.response?.data?.error?.message || 'Failed to drop course');
    }
  };

  const handleLeaveWaitlist = async (waitlistId: number) => {
    try {
      await api.delete(`/waitlist/${waitlistId}`);
      addToast('info', 'Removed from waiting list');
      await fetchAll();
    } catch {
      addToast('error', 'Failed to leave waiting list');
    }
  };

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold text-slate-900">My Registrations</h1>
          <span className="text-xs font-mono font-bold text-[#1E3A8A]">
            Total Credits: {totalCredits} / 24
          </span>
        </div>

        {loading ? (
          <div className="bg-white rounded-xl border border-slate-200 p-10 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-[#1E3A8A]" />
          </div>
        ) : (
          <>
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-800">
                Registered Courses ({registeredCourses.length})
              </div>
              {registeredCourses.length === 0 ? (
                <p className="p-6 text-center text-xs text-slate-400">No courses registered.</p>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-500">
                      <th className="py-2 px-4">Code</th>
                      <th className="py-2 px-4">Name</th>
                      <th className="py-2 px-4">Faculty</th>
                      <th className="py-2 px-4">Schedule</th>
                      <th className="py-2 px-4 text-right">Credits</th>
                      <th className="py-2 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {registeredCourses.map((c) => (
                      <tr key={c.id}>
                        <td className="py-2.5 px-4 font-mono font-semibold text-[#1E3A8A]">{c.code}</td>
                        <td className="py-2.5 px-4 font-semibold text-slate-900">{c.name}</td>
                        <td className="py-2.5 px-4 text-slate-500">{c.faculty}</td>
                        <td className="py-2.5 px-4 text-slate-500">{c.schedule}</td>
                        <td className="py-2.5 px-4 text-right font-mono">{c.credits}</td>
                        <td className="py-2.5 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => handleDropCourse(c.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-red-600 hover:bg-red-50 rounded font-semibold cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Drop</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {waitlistEntries.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-800">
                  Waiting List ({waitlistEntries.length})
                </div>
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-500">
                      <th className="py-2 px-4">Code</th>
                      <th className="py-2 px-4">Name</th>
                      <th className="py-2 px-4 text-right">Position</th>
                      <th className="py-2 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {waitlistEntries.map((w) => (
                      <tr key={w.id}>
                        <td className="py-2.5 px-4 font-mono font-semibold text-[#1E3A8A]">{w.code}</td>
                        <td className="py-2.5 px-4 font-semibold text-slate-900">{w.name}</td>
                        <td className="py-2.5 px-4 text-right font-mono font-bold text-amber-700">
                          #{w.position}
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => handleLeaveWaitlist(w.id)}
                            className="px-2.5 py-1 text-slate-600 hover:bg-slate-100 rounded font-semibold cursor-pointer"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
};

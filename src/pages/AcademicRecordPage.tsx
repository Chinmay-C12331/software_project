import { Loader2 } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../api.ts';
import { Layout } from '../components/Layout.tsx';
import { useRegistration } from '../context/RegistrationContext.tsx';

interface AcademicRecordItem {
  id: number;
  status: 'COMPLETED' | 'REGISTERED';
  grade: string | null;
  semester: number;
  code: string;
  name: string;
  credits: number;
}

export const AcademicRecordPage: React.FC = () => {
  const { addToast } = useRegistration();

  const [completed, setCompleted] = useState<AcademicRecordItem[]>([]);
  const [registered, setRegistered] = useState<AcademicRecordItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTranscript = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/academic-record');
      setCompleted(res.data.completed);
      setRegistered(res.data.registered);
    } catch {
      addToast('error', 'Failed to load academic record');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    fetchTranscript();
  }, [fetchTranscript]);

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <h1 className="text-lg font-bold text-slate-900">Academic Record</h1>

        {loading ? (
          <div className="bg-white rounded-xl border border-slate-200 p-10 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-[#1E3A8A]" />
          </div>
        ) : (
          <>
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-800">
                Registered Courses ({registered.length})
              </div>
              {registered.length === 0 ? (
                <p className="p-6 text-center text-xs text-slate-400">No active registrations.</p>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-500">
                      <th className="py-2 px-4">Code</th>
                      <th className="py-2 px-4">Name</th>
                      <th className="py-2 px-4">Semester</th>
                      <th className="py-2 px-4 text-right">Credits</th>
                      <th className="py-2 px-4 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {registered.map((r) => (
                      <tr key={r.id}>
                        <td className="py-2.5 px-4 font-mono font-semibold text-[#1E3A8A]">{r.code}</td>
                        <td className="py-2.5 px-4 font-semibold text-slate-900">{r.name}</td>
                        <td className="py-2.5 px-4 text-slate-500">Sem {r.semester}</td>
                        <td className="py-2.5 px-4 text-right font-mono">{r.credits}</td>
                        <td className="py-2.5 px-4 text-right font-semibold text-teal-700">REGISTERED</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-800">
                Completed Courses ({completed.length})
              </div>
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-500">
                    <th className="py-2 px-4">Code</th>
                    <th className="py-2 px-4">Name</th>
                    <th className="py-2 px-4">Semester</th>
                    <th className="py-2 px-4 text-right">Credits</th>
                    <th className="py-2 px-4 text-right">Grade</th>
                    <th className="py-2 px-4 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {completed.map((c) => (
                    <tr key={c.id}>
                      <td className="py-2.5 px-4 font-mono font-semibold text-[#1E3A8A]">{c.code}</td>
                      <td className="py-2.5 px-4 font-semibold text-slate-900">{c.name}</td>
                      <td className="py-2.5 px-4 text-slate-500">Sem {c.semester}</td>
                      <td className="py-2.5 px-4 text-right font-mono">{c.credits}</td>
                      <td className="py-2.5 px-4 text-right font-mono font-bold">{c.grade || 'A'}</td>
                      <td className="py-2.5 px-4 text-right font-semibold text-emerald-700">COMPLETED</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
};

/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { fetchApi } from '../../../api/client';
import { fetchCertifications } from '../../../api/certifications';
import {
  Plus,
  Trash2,
  Loader2,
  X,
  Pencil,
  CheckCircle2,
  Eye,
  EyeOff,
  Search,
  AlertCircle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { usePagination, paginate } from '../../../hooks/usePagination';
import Pagination from '../../ui/Pagination';

interface ExamsPanelProps {
  onSelectExam: (exam: any, openEdit?: boolean, ids?: string[]) => void;
}

const EMPTY_FORM = {
  name: '',
  description: '',
  duration: 120,
  totalQuestions: 50,
  passingScore: 70,
  questionSelectionStrategy: 'random' as 'random' | 'difficulty_balanced' | 'topic_based',
  topicWeights: {} as Record<string, number>,
  isActive: true,
};

export default function ExamsPanel({ onSelectExam }: ExamsPanelProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [allCerts, setAllCerts] = useState<any[]>([]);
  const activeCertId = searchParams.get('certId') ?? '';
  const activeCert = allCerts.find((c) => c.id === activeCertId) ?? null;
  const setActiveCert = (cert: any) => {
    const p = new URLSearchParams(searchParams);
    if (cert) {
      p.set('certId', cert.id);
    } else {
      p.delete('certId');
    }
    p.set('page', '1');
    setSearchParams(p, { replace: true });
  };
  const [exams, setExams] = useState<any[]>([]);
  const [topics, setTopics] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [examForm, setExamForm] = useState(EMPTY_FORM);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const search = searchParams.get('search') ?? '';
  const filterStatus = searchParams.get('status') ?? '';

  const setSearch = (val: string) => {
    const p = new URLSearchParams(searchParams);
    if (val) p.set('search', val);
    else p.delete('search');
    p.delete('page');
    setSearchParams(p, { replace: true });
  };
  const setFilterStatus = (val: string) => {
    const p = new URLSearchParams(searchParams);
    if (val) p.set('status', val);
    else p.delete('status');
    p.delete('page');
    setSearchParams(p, { replace: true });
  };

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), type === 'error' ? 5000 : 3000);
  };

  // Load all certs once
  useEffect(() => {
    fetchCertifications().then(setAllCerts).catch(console.error);
  }, []);

  // Fetch exams: all certs or filtered by activeCert
  useEffect(() => {
    const certsToFetch = activeCert ? [activeCert] : allCerts;
    if (certsToFetch.length === 0) return;
    setLoading(true);
    Promise.all(
      certsToFetch.map((c) =>
        fetchApi(`/certifications/${c.id}/exams?all=true`)
          .then((data: any[]) => data.map((e) => ({ ...e, _certTitle: c.title, _certId: c.id })))
          .catch(() => []),
      ),
    ).then((results) => {
      setExams(results.flat());
      setLoading(false);
    });
  }, [activeCert, allCerts]);

  // Fetch topics for form (only when activeCert is set)
  useEffect(() => {
    if (activeCert) {
      fetchApi(`/certifications/${activeCert.id}/topics`).then(setTopics).catch(console.error);
    }
  }, [activeCert]);

  const openAdd = () => {
    setEditingId(null);
    setExamForm(EMPTY_FORM);
    setShowAddForm(true);
  };

  const openEdit = (exam: any) => {
    buildNavigationContextAndNavigate(exam, true); // open directly in edit mode
  };

  /**
   * Build navigation context from current filter state and navigate to detail view
   * Encodes filtered IDs and filter state in URL for navigation support
   */
  const buildNavigationContextAndNavigate = (exam: any, openEdit?: boolean) => {
    // Extract filtered exam IDs from current filter state
    const ids = filtered.map((e) => e.id);

    // Build filter state to preserve in navigation context
    const filters: Record<string, string> = {};
    if (search) {
      filters.search = search;
    }
    if (filterStatus) {
      filters.status = filterStatus;
    }
    if (activeCertId) {
      filters.certId = activeCertId;
    }

    // Pass IDs and filters to parent component
    // The parent will encode these in the URL with proper format:
    // - ids: comma-separated list
    // - nav-prefixed filter parameters (navSearch, navStatus, navCertId)
    onSelectExam(exam, openEdit, ids);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCert) return;
    setLoading(true);
    try {
      // topicWeights intentionally empty — server derives from topic.weightPercentage
      const examDataWithDefaults = {
        ...examForm,
        passingScore: 70,
        topicWeights: {},
      };

      if (editingId) {
        await fetchApi(`/exams/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify(examDataWithDefaults),
        });
        showToast('Exam configuration updated successfully');
      } else {
        await fetchApi(`/certifications/${activeCert.id}/exams`, {
          method: 'POST',
          body: JSON.stringify(examDataWithDefaults),
        });
        showToast('Exam configuration saved successfully');
      }
      setShowAddForm(false);
      setEditingId(null);
      setExamForm(EMPTY_FORM);
      // Refresh
      const data = await fetchApi(`/certifications/${activeCert.id}/exams?all=true`);
      setExams((prev) => [
        ...prev.filter((ex) => ex._certId !== activeCert.id),
        ...(data as any[]).map((e: any) => ({
          ...e,
          _certTitle: activeCert.title,
          _certId: activeCert.id,
        })),
      ]);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const deleteExam = async (exam: any) => {
    setLoading(true);
    try {
      await fetchApi(`/exams/${exam.id}`, { method: 'DELETE' });
      setExams((prev) => prev.filter((ex) => ex.id !== exam.id));
      showToast('Exam configuration deleted successfully');
    } catch (e: any) {
      showToast(e?.message ?? 'Failed to delete exam configuration', 'error');
    }
    setLoading(false);
    setPendingDeleteId(null);
  };

  const toggleActive = async (exam: any) => {
    try {
      await fetchApi(`/exams/${exam.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !exam.isActive }),
      });
      setExams((prev) =>
        prev.map((ex) => (ex.id === exam.id ? { ...ex, isActive: !exam.isActive } : ex)),
      );
      showToast(exam.isActive ? 'Exam deactivated' : 'Exam activated');
    } catch (e) {
      console.error(e);
    }
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return exams.filter((ex) => {
      const matchSearch =
        !q || ex.name.toLowerCase().includes(q) || (ex.description ?? '').toLowerCase().includes(q);
      const matchStatus = !filterStatus || (filterStatus === 'active' ? ex.isActive : !ex.isActive);
      return matchSearch && matchStatus;
    });
  }, [exams, search, filterStatus]);

  const { page, pageSize, setPage, setPageSize } = usePagination();
  const paginated = paginate(filtered as any[], page, pageSize);

  return (
    <>
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            className={`fixed top-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-5 py-3 rounded-2xl shadow-xl font-bold text-sm text-white max-w-md text-center ${toast.type === 'error' ? 'bg-rose-600' : 'bg-emerald-600'}`}
          >
            {toast.type === 'error' ? (
              <AlertCircle className="w-4 h-4 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            )}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {pendingDeleteId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setPendingDeleteId(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-rose-100 rounded-2xl">
                  <AlertCircle className="w-6 h-6 text-rose-600" />
                </div>
                <h3 className="text-xl font-black text-slate-900">Delete Exam?</h3>
              </div>
              <p className="text-slate-600 mb-6">Are you sure? This action cannot be undone.</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setPendingDeleteId(null)}
                  className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    const e = exams.find((x) => x.id === pendingDeleteId);
                    if (e) deleteExam(e);
                  }}
                  disabled={loading}
                  className="flex-1 px-4 py-3 bg-rose-600 text-white rounded-xl font-bold hover:bg-rose-700 transition-all disabled:opacity-50"
                >
                  {loading ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900">Exams Management</h2>
          {activeCert && (
            <button
              onClick={() => setActiveCert(null)}
              className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded uppercase tracking-wider mt-2 inline-flex items-center gap-1 hover:bg-indigo-100 transition-colors"
            >
              {activeCert.title} <X className="w-3 h-3" />
            </button>
          )}
        </div>
        {!showAddForm && (
          <button
            onClick={() => {
              if (!activeCert && allCerts.length > 0) setActiveCert(allCerts[0]);
              openAdd();
            }}
            className="flex items-center justify-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all"
          >
            <Plus className="w-5 h-5" /> Add Exam
          </button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {showAddForm ? (
          <motion.div
            key="form"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-slate-50 rounded-2xl p-6 mb-8 border border-slate-100"
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest">
                {editingId ? 'Edit Exam Configuration' : 'New Exam Configuration'}
              </h3>
              <button
                onClick={() => setShowAddForm(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Cert selector in form */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
                  Certification
                </label>
                <select
                  value={activeCert?.id ?? ''}
                  onChange={(e) =>
                    setActiveCert(allCerts.find((c) => c.id === e.target.value) ?? null)
                  }
                  className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:border-indigo-600 bg-white"
                  required
                >
                  <option value="">Select a certification...</option>
                  {allCerts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
                  Exam Name
                </label>
                <input
                  type="text"
                  value={examForm.name}
                  onChange={(e) => setExamForm({ ...examForm, name: e.target.value })}
                  className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:border-indigo-600"
                  placeholder="e.g. Full Mock Exam 1"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
                  Description (Optional)
                </label>
                <textarea
                  value={examForm.description}
                  onChange={(e) => setExamForm({ ...examForm, description: e.target.value })}
                  className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:border-indigo-600 h-20"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
                    Duration (Min)
                  </label>
                  <input
                    type="number"
                    value={examForm.duration}
                    onChange={(e) =>
                      setExamForm({
                        ...examForm,
                        duration: e.target.value === '' ? '' : parseInt(e.target.value),
                      })
                    }
                    onBlur={(e) => {
                      const v = parseInt(e.target.value);
                      setExamForm({
                        ...examForm,
                        duration: isNaN(v) ? 15 : Math.min(480, Math.max(15, v)),
                      });
                    }}
                    className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:border-indigo-600"
                    min="15"
                    max="480"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
                    Total Questions
                  </label>
                  <input
                    type="number"
                    value={examForm.totalQuestions}
                    onChange={(e) =>
                      setExamForm({
                        ...examForm,
                        totalQuestions: e.target.value === '' ? '' : parseInt(e.target.value),
                      })
                    }
                    onBlur={(e) => {
                      const v = parseInt(e.target.value);
                      setExamForm({
                        ...examForm,
                        totalQuestions: isNaN(v) ? 5 : Math.min(500, Math.max(5, v)),
                      });
                    }}
                    className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:border-indigo-600"
                    min="5"
                    max="500"
                    required
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
                  Selection Strategy
                </label>
                <select
                  value={examForm.questionSelectionStrategy}
                  onChange={(e) =>
                    setExamForm({ ...examForm, questionSelectionStrategy: e.target.value as any })
                  }
                  className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:border-indigo-600 bg-white"
                >
                  <option value="random">Random Selection</option>
                  <option value="difficulty_balanced">Difficulty Balanced</option>
                  <option value="topic_based">Topic Based (Weighted)</option>
                </select>
              </div>
              {examForm.questionSelectionStrategy === 'topic_based' && (
                <div className="space-y-2 p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-indigo-600 uppercase tracking-widest">
                      Topic Weights (from Topic Configuration)
                    </label>
                    <a
                      href="/admin/topics"
                      className="text-xs text-indigo-500 hover:text-indigo-700 font-bold underline"
                    >
                      Edit in Topics →
                    </a>
                  </div>
                  <p className="text-xs text-slate-500 mb-2">
                    Weights are automatically derived from each topic's Weight % setting.
                  </p>
                  {topics.filter((t) => (t.weightPercentage ?? 0) > 0).length === 0 ? (
                    <p className="text-xs text-amber-600 font-medium">
                      No topic weights configured. Set Weight % on topics to enable proportional
                      selection.
                    </p>
                  ) : (
                    (() => {
                      const weighted = topics.filter((t) => (t.weightPercentage ?? 0) > 0);
                      const total = weighted.reduce(
                        (s: number, t: any) => s + t.weightPercentage,
                        0,
                      );
                      return weighted.map((t: any) => (
                        <div key={t.id} className="flex items-center gap-3 py-0.5">
                          <span className="text-sm text-slate-700 flex-1 truncate">{t.title}</span>
                          <div className="w-24 bg-slate-200 rounded-full h-1.5">
                            <div
                              className="bg-indigo-500 h-1.5 rounded-full"
                              style={{
                                width: `${((t.weightPercentage / total) * 100).toFixed(1)}%`,
                              }}
                            />
                          </div>
                          <span className="text-xs font-bold text-slate-600 w-10 text-right">
                            {((t.weightPercentage / total) * 100).toFixed(1)}%
                          </span>
                        </div>
                      ));
                    })()
                  )}
                </div>
              )}
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={examForm.isActive}
                  onChange={(e) => setExamForm({ ...examForm, isActive: e.target.checked })}
                  className="w-4 h-4 accent-indigo-600"
                />
                <span className="text-sm font-bold text-slate-600">
                  Active (visible to learners)
                </span>
              </label>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all disabled:opacity-50"
              >
                {editingId ? 'Update Exam Configuration' : 'Save Exam Configuration'}
              </button>
            </form>
          </motion.div>
        ) : (
          <motion.div
            key="list"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-4"
          >
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:border-indigo-400 text-sm text-slate-900 bg-white"
                  placeholder="Search exams..."
                />
              </div>
              <select
                value={activeCert?.id ?? ''}
                onChange={(e) =>
                  setActiveCert(allCerts.find((c) => c.id === e.target.value) ?? null)
                }
                className="px-3 py-2.5 rounded-xl border border-slate-200 outline-none focus:border-indigo-400 text-sm bg-white text-slate-600 font-bold"
              >
                <option value="">All Certifications</option>
                {allCerts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-2.5 rounded-xl border border-slate-200 outline-none focus:border-indigo-400 text-sm bg-white text-slate-600 font-bold"
              >
                <option value="">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <p className="text-sm text-slate-500 font-medium">
              Showing{' '}
              <span className="font-bold text-slate-700">
                {Math.min((page - 1) * pageSize + 1, filtered.length)}–
                {Math.min(page * pageSize, filtered.length)}
              </span>{' '}
              of <span className="font-bold text-slate-700">{filtered.length}</span> exams
              {filtered.length < exams.length && (
                <span className="text-slate-400"> (filtered from {exams.length})</span>
              )}
            </p>
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
                <p className="text-slate-400 font-bold animate-pulse">Loading data...</p>
              </div>
            ) : filtered.length === 0 ? (
              <p className="text-center py-12 text-slate-400 font-bold">No exams found.</p>
            ) : (
              paginated.map((exam) => (
                <div
                  key={exam.id}
                  className="group flex items-center justify-between p-5 bg-white border border-slate-100 rounded-2xl hover:border-indigo-100 hover:shadow-sm transition-all"
                >
                  <div
                    className="flex-1 cursor-pointer"
                    onClick={() => buildNavigationContextAndNavigate(exam)}
                  >
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="font-bold text-slate-900 text-lg">{exam.name}</h3>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-500 uppercase tracking-wider">
                        {exam.questionSelectionStrategy.replace(/_/g, ' ')}
                      </span>
                      {!exam.isActive && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-600 uppercase tracking-wider">
                          Inactive
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-500">
                      {exam.totalQuestions} Questions • {exam.duration} Minutes
                    </p>
                    {exam.description && (
                      <p className="text-xs text-slate-400 mt-1 line-clamp-1">{exam.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleActive(exam)}
                      className={`p-2 transition-colors ${exam.isActive ? 'text-slate-300 hover:text-amber-500' : 'text-rose-400 hover:text-emerald-600'}`}
                    >
                      {exam.isActive ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => openEdit(exam)}
                      className="p-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setPendingDeleteId(exam.id)}
                      className="p-2 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))
            )}
            <Pagination
              page={page}
              pageSize={pageSize}
              total={filtered.length}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

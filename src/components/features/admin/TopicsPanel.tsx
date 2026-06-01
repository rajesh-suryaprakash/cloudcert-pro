/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { fetchApi } from '../../../api/client';
import { fetchCertifications } from '../../../api/certifications';
import { Plus, Trash2, Loader2, X, Pencil, CheckCircle2, Search, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { usePagination, paginate } from '../../../hooks/usePagination';
import Pagination from '../../ui/Pagination';

interface TopicsPanelProps {
  onSelectTopic: (topic: any, openEdit?: boolean, ids?: string[]) => void;
}

const EMPTY_FORM = { title: '', description: '', orderIndex: 0, docUrl: '', weightPercentage: 0 };

export default function TopicsPanel({ onSelectTopic }: TopicsPanelProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [allCerts, setAllCerts] = useState<any[]>([]);
  // activeCert is derived from the URL ?certId= param — single source of truth
  const activeCertId = searchParams.get('certId') ?? '';
  const activeCert = allCerts.find((c) => c.id === activeCertId) ?? null;

  const setActiveCert = (cert: any) => {
    const p = new URLSearchParams(searchParams);
    if (cert) {
      p.set('certId', cert.id);
    } else {
      p.delete('certId');
    }
    p.set('page', '1'); // reset page when filter changes
    setSearchParams(p, { replace: true });
  };

  const [topics, setTopics] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [topicForm, setTopicForm] = useState(EMPTY_FORM);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [docUrlError, setDocUrlError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), type === 'error' ? 5000 : 3000);
  };

  useEffect(() => {
    fetchCertifications().then(setAllCerts).catch(console.error);
  }, []);

  useEffect(() => {
    if (allCerts.length === 0) return; // wait for certs to load
    const certsToFetch = activeCertId ? allCerts.filter((c) => c.id === activeCertId) : allCerts;
    if (certsToFetch.length === 0) return;
    setLoading(true);
    Promise.all(
      certsToFetch.map((c) =>
        fetchApi(`/certifications/${c.id}/topics`)
          .then((data: any[]) => data.map((t) => ({ ...t, _certTitle: c.title, _certId: c.id })))
          .catch(() => []),
      ),
    ).then((results) => {
      setTopics(results.flat());
      setLoading(false);
    });
  }, [activeCertId, allCerts]);

  const openAdd = () => {
    setEditingId(null);
    setTopicForm(EMPTY_FORM);
    setDocUrlError(null);
    setShowAddForm(true);
  };

  const openEdit = (topic: any) => {
    buildNavigationContextAndNavigate(topic, true); // open directly in edit mode
  };

  /**
   * Build navigation context from current filter state and navigate to detail view
   * Encodes filtered IDs and filter state in URL for navigation support
   */
  const buildNavigationContextAndNavigate = (topic: any, openEdit?: boolean) => {
    // Extract filtered topic IDs from current filter state
    const ids = filtered.map((t) => t.id);

    // Build filter state to preserve in navigation context
    const filters: Record<string, string> = {};
    if (search) {
      filters.search = search;
    }
    if (activeCertId) {
      filters.certId = activeCertId;
    }

    // Pass IDs and filters to parent component
    // The parent will encode these in the URL with proper format:
    // - ids: comma-separated list
    // - nav-prefixed filter parameters (navSearch, navCertId)
    onSelectTopic(topic, openEdit, ids);
  };

  const handleDocUrlChange = (value: string) => {
    setTopicForm({ ...topicForm, docUrl: value });
    setDocUrlError(
      value && !value.startsWith('https://') ? 'Documentation URL must start with https://' : null,
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCert) return;
    if (topicForm.docUrl && !topicForm.docUrl.startsWith('https://')) {
      setDocUrlError('Documentation URL must start with https://');
      return;
    }
    setLoading(true);
    try {
      const payload = { ...topicForm, docUrl: topicForm.docUrl || null };
      if (editingId) {
        await fetchApi(`/topics/${editingId}`, { method: 'PUT', body: JSON.stringify(payload) });
        showToast('Topic updated successfully');
      } else {
        await fetchApi(`/certifications/${activeCert.id}/topics`, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        showToast('Topic saved successfully');
      }
      setShowAddForm(false);
      setEditingId(null);
      setTopicForm(EMPTY_FORM);
      setDocUrlError(null);
      const data = await fetchApi(`/certifications/${activeCert.id}/topics`);
      setTopics((prev) => [
        ...prev.filter((t) => t._certId !== activeCert.id),
        ...(data as any[]).map((t: any) => ({
          ...t,
          _certTitle: activeCert.title,
          _certId: activeCert.id,
        })),
      ]);
    } catch (e: any) {
      showToast(e?.message ?? 'Failed to save topic', 'error');
    }
    setLoading(false);
  };

  const deleteTopic = async (topic: any) => {
    setLoading(true);
    try {
      await fetchApi(`/topics/${topic.id}`, { method: 'DELETE' });
      setTopics((prev) => prev.filter((t) => t.id !== topic.id));
      showToast('Topic deleted successfully');
    } catch (e: any) {
      showToast(e?.message ?? 'Failed to delete topic', 'error');
    }
    setLoading(false);
    setPendingDeleteId(null);
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return topics.filter(
      (t) =>
        !q || t.title.toLowerCase().includes(q) || (t.description ?? '').toLowerCase().includes(q),
    );
  }, [topics, search]);

  const { page, pageSize, setPage, setPageSize } = usePagination();
  const paginated = paginate(filtered, page, pageSize);

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
                <h3 className="text-xl font-black text-slate-900">Delete Topic?</h3>
              </div>
              <p className="text-slate-600 mb-6">
                Are you sure? This will also delete all associated subtopics and questions. This
                action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setPendingDeleteId(null)}
                  className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    const t = topics.find((x) => x.id === pendingDeleteId);
                    if (t) deleteTopic(t);
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
          <h2 className="text-2xl font-black text-slate-900">Topics Management</h2>
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
            onClick={openAdd}
            className="flex items-center justify-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all"
          >
            <Plus className="w-5 h-5" /> Add Topic
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
                {editingId ? 'Edit Topic' : 'New Topic'}
              </h3>
              <button
                onClick={() => setShowAddForm(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
                    Topic Title
                  </label>
                  <input
                    type="text"
                    value={topicForm.title}
                    onChange={(e) => setTopicForm({ ...topicForm, title: e.target.value })}
                    className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:border-indigo-600"
                    placeholder="e.g. Identity & Access Management"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
                    Order Index
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={topicForm.orderIndex}
                    onChange={(e) => setTopicForm({ ...topicForm, orderIndex: e.target.value === '' ? '' : parseInt(e.target.value) })}
                    onBlur={(e) => { const v = parseInt(e.target.value); setTopicForm({ ...topicForm, orderIndex: isNaN(v) ? 0 : Math.max(0, v) }); }}
                    className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:border-indigo-600"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
                    Weight %
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={topicForm.weightPercentage}
                    onChange={(e) => setTopicForm({ ...topicForm, weightPercentage: e.target.value === '' ? '' : parseFloat(e.target.value) })}
                    onBlur={(e) => { const v = parseFloat(e.target.value); setTopicForm({ ...topicForm, weightPercentage: isNaN(v) ? 0 : Math.min(100, Math.max(0, v)) }); }}
                    className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:border-indigo-600"
                    placeholder="0.0"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
                  Description (Optional)
                </label>
                <textarea
                  value={topicForm.description}
                  onChange={(e) => setTopicForm({ ...topicForm, description: e.target.value })}
                  className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:border-indigo-600 h-24"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
                  Documentation URL (Optional)
                </label>
                <input
                  type="text"
                  value={topicForm.docUrl}
                  onChange={(e) => handleDocUrlChange(e.target.value)}
                  className={`w-full p-3 rounded-xl border outline-none focus:border-indigo-600 ${docUrlError ? 'border-rose-400' : 'border-slate-200'}`}
                  placeholder="https://..."
                />
                {docUrlError && <p className="text-xs text-rose-500 px-1 mt-1">{docUrlError}</p>}
              </div>
              <button
                type="submit"
                disabled={!!docUrlError || loading}
                className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all disabled:opacity-50"
              >
                {editingId ? 'Update Topic' : 'Save Topic'}
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
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:border-indigo-400 text-sm text-slate-900 bg-white"
                  placeholder="Search topics..."
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
            </div>
            <p className="text-sm text-slate-500 font-medium">
              Showing{' '}
              <span className="font-bold text-slate-700">
                {Math.min((page - 1) * pageSize + 1, filtered.length)}–
                {Math.min(page * pageSize, filtered.length)}
              </span>{' '}
              of <span className="font-bold text-slate-700">{filtered.length}</span> topics
              {filtered.length < topics.length && (
                <span className="text-slate-400"> (filtered from {topics.length})</span>
              )}
            </p>
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
                <p className="text-slate-400 font-bold animate-pulse">Loading data...</p>
              </div>
            ) : filtered.length === 0 ? (
              <p className="text-center py-12 text-slate-400 font-bold">No topics found.</p>
            ) : (
              paginated.map((topic) => (
                <div
                  key={topic.id}
                  className="group flex items-center justify-between p-5 bg-white border border-slate-100 rounded-2xl hover:border-indigo-100 hover:shadow-sm transition-all"
                >
                  <div
                    className="flex-1 cursor-pointer"
                    onClick={() => buildNavigationContextAndNavigate(topic)}
                  >
                    <div className="flex items-center gap-3 mb-1 flex-wrap">
                      <h3 className="font-bold text-slate-900 text-lg">{topic.title}</h3>
                      {!topic.isActive && (
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-rose-100 text-rose-700">
                          Inactive
                        </span>
                      )}
                    </div>
                    {topic.description && (
                      <p className="text-sm text-slate-500 line-clamp-1">{topic.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openEdit(topic)}
                      className="p-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setPendingDeleteId(topic.id)}
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

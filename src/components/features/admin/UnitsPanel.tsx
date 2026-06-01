/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { fetchApi } from '../../../api/client';
import { fetchCertifications } from '../../../api/certifications';
import { Plus, Loader2, X, Pencil, Trash2, CheckCircle2, Search, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { usePagination, paginate } from '../../../hooks/usePagination';
import Pagination from '../../ui/Pagination';

interface UnitsPanelProps {
  onSelectUnit: (unit: any, openEdit?: boolean, ids?: string[]) => void;
}

export default function UnitsPanel({ onSelectUnit }: UnitsPanelProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [allCerts, setAllCerts] = useState<any[]>([]);
  const [allTopics, setAllTopics] = useState<any[]>([]);
  const [allSubTopics, setAllSubTopics] = useState<any[]>([]);

  const activeCertId = searchParams.get('certId') ?? '';
  const activeTopicId = searchParams.get('topicId') ?? '';
  const activeSubTopicId = searchParams.get('subTopicId') ?? '';

  const activeCert = allCerts.find((c) => c.id === activeCertId) ?? null;
  const activeTopic = allTopics.find((t) => t.id === activeTopicId) ?? null;
  const activeSubTopic = allSubTopics.find((s) => s.id === activeSubTopicId) ?? null;

  const setActiveCert = (cert: any) => {
    const p = new URLSearchParams(searchParams);
    if (cert) {
      p.set('certId', cert.id);
    } else {
      p.delete('certId');
    }
    p.delete('topicId');
    p.delete('subTopicId');
    p.set('page', '1');
    setSearchParams(p, { replace: true });
  };

  const setActiveTopic = (topic: any) => {
    const p = new URLSearchParams(searchParams);
    if (topic) {
      p.set('topicId', topic.id);
    } else {
      p.delete('topicId');
    }
    p.delete('subTopicId');
    p.set('page', '1');
    setSearchParams(p, { replace: true });
  };

  const setActiveSubTopic = (sub: any) => {
    const p = new URLSearchParams(searchParams);
    if (sub) {
      p.set('subTopicId', sub.id);
    } else {
      p.delete('subTopicId');
    }
    p.set('page', '1');
    setSearchParams(p, { replace: true });
  };

  const [units, setUnits] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [unitForm, setUnitForm] = useState({ title: '', description: '', orderIndex: 0 });
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [search, setSearch] = useState('');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), type === 'error' ? 5000 : 3000);
  };

  // Load all certifications once
  useEffect(() => {
    fetchCertifications().then(setAllCerts).catch(console.error);
  }, []);

  // Load topics whenever cert filter changes
  useEffect(() => {
    if (allCerts.length === 0) return;
    const certsToFetch = activeCertId ? allCerts.filter((c) => c.id === activeCertId) : allCerts;
    if (certsToFetch.length === 0) return;
    Promise.all(
      certsToFetch.map((c) =>
        fetchApi(`/certifications/${c.id}/topics`)
          .then((data: any[]) => data.map((t) => ({ ...t, _certTitle: c.title, _certId: c.id })))
          .catch(() => []),
      ),
    ).then((results) => setAllTopics(results.flat()));
  }, [activeCertId, allCerts]);

  // Load subtopics whenever topic filter changes
  useEffect(() => {
    if (allTopics.length === 0) return;
    const topicsToFetch = activeTopicId
      ? allTopics.filter((t) => t.id === activeTopicId)
      : allTopics;
    if (topicsToFetch.length === 0) return;
    Promise.all(
      topicsToFetch.map((t) =>
        fetchApi(`/topics/${t.id}/subtopics`)
          .then((data: any[]) =>
            data.map((s) => ({
              ...s,
              _topicTitle: t.title,
              _topicId: t.id,
              _certTitle: t._certTitle,
              _certId: t._certId,
            })),
          )
          .catch(() => []),
      ),
    ).then((results) => setAllSubTopics(results.flat()));
  }, [activeTopicId, allTopics]);

  // Load units whenever subtopic filter changes
  useEffect(() => {
    if (allSubTopics.length === 0) {
      setUnits([]);
      return;
    }
    const subsToFetch = activeSubTopicId
      ? allSubTopics.filter((s) => s.id === activeSubTopicId)
      : allSubTopics;
    if (subsToFetch.length === 0) {
      setUnits([]);
      return;
    }
    setLoading(true);
    Promise.all(
      subsToFetch.map((s) =>
        fetchApi(`/subtopics/${s.id}/units`)
          .then((data: any[]) =>
            data.map((u) => ({
              ...u,
              _subTopicTitle: s.title,
              _subTopicId: s.id,
              _topicTitle: s._topicTitle,
              _topicId: s._topicId,
              _certTitle: s._certTitle,
              _certId: s._certId,
            })),
          )
          .catch(() => []),
      ),
    ).then((results) => {
      setUnits(results.flat());
      setLoading(false);
    });
  }, [activeSubTopicId, allSubTopics]);

  const buildNavigationContextAndNavigate = (unit: any, openEdit?: boolean) => {
    const ids = filtered.map((u) => u.id);
    onSelectUnit(unit, openEdit, ids);
  };

  const openAdd = () => {
    setUnitForm({ title: '', description: '', orderIndex: 0 });
    setShowAddForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSubTopic) return;
    setLoading(true);
    try {
      await fetchApi(`/subtopics/${activeSubTopic.id}/units`, {
        method: 'POST',
        body: JSON.stringify(unitForm),
      });
      showToast('Unit saved successfully');
      setShowAddForm(false);
      setUnitForm({ title: '', description: '', orderIndex: 0 });
      // Refresh units for the active subtopic
      const data = await fetchApi(`/subtopics/${activeSubTopic.id}/units`);
      setUnits((prev) => [
        ...prev.filter((u) => u._subTopicId !== activeSubTopic.id),
        ...(data as any[]).map((u: any) => ({
          ...u,
          _subTopicTitle: activeSubTopic.title,
          _subTopicId: activeSubTopic.id,
          _topicTitle: activeSubTopic._topicTitle,
          _topicId: activeSubTopic._topicId,
          _certTitle: activeSubTopic._certTitle,
          _certId: activeSubTopic._certId,
        })),
      ]);
    } catch (err: any) {
      showToast(err?.message ?? 'Failed to save unit', 'error');
    }
    setLoading(false);
  };

  const openEdit = (unit: any) => {
    buildNavigationContextAndNavigate(unit, true);
  };

  const deleteUnit = async (unit: any) => {
    setLoading(true);
    try {
      await fetchApi(`/units/${unit.id}`, { method: 'DELETE' });
      setUnits((prev) => prev.filter((u) => u.id !== unit.id));
      showToast('Unit deleted successfully');
    } catch (e: any) {
      showToast(e?.message ?? 'Failed to delete unit', 'error');
    }
    setLoading(false);
    setPendingDeleteId(null);
  };

  const filteredTopics = useMemo(
    () => (activeCertId ? allTopics.filter((t) => t._certId === activeCertId) : allTopics),
    [allTopics, activeCertId],
  );

  const filteredSubTopics = useMemo(
    () =>
      activeTopicId
        ? allSubTopics.filter((s) => s._topicId === activeTopicId)
        : activeCertId
          ? allSubTopics.filter((s) => s._certId === activeCertId)
          : allSubTopics,
    [allSubTopics, activeTopicId, activeCertId],
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return units.filter((u) => {
      const matchSearch =
        !q ||
        u.title.toLowerCase().includes(q) ||
        (u.description ?? '').toLowerCase().includes(q);
      const matchSubTopic = !activeSubTopicId || u._subTopicId === activeSubTopicId;
      const matchTopic = !activeTopicId || u._topicId === activeTopicId;
      const matchCert = !activeCertId || u._certId === activeCertId;
      return matchSearch && matchSubTopic && matchTopic && matchCert;
    });
  }, [units, search, activeSubTopicId, activeTopicId, activeCertId]);

  const { page, pageSize, setPage, setPageSize } = usePagination();
  const paginated = paginate(filtered, page, pageSize);

  return (
    <>
      {/* Toast */}
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
                <h3 className="text-xl font-black text-slate-900">Delete Unit?</h3>
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
                    const u = units.find((x) => x.id === pendingDeleteId);
                    if (u) deleteUnit(u);
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

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900">Units Management</h2>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            {activeCert && (
              <button
                onClick={() => {
                  setSearchParams({}, { replace: true });
                }}
                className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded uppercase tracking-wider inline-flex items-center gap-1 hover:bg-indigo-100 transition-colors"
              >
                {activeCert.title} <X className="w-3 h-3" />
              </button>
            )}
            {activeTopic && (
              <button
                onClick={() => setActiveTopic(null)}
                className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded uppercase tracking-wider inline-flex items-center gap-1 hover:bg-amber-100 transition-colors"
              >
                {activeTopic.title} <X className="w-3 h-3" />
              </button>
            )}
            {activeSubTopic && (
              <button
                onClick={() => setActiveSubTopic(null)}
                className="text-xs font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded uppercase tracking-wider inline-flex items-center gap-1 hover:bg-rose-100 transition-colors"
              >
                {activeSubTopic.title} <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
        {!showAddForm && (
          <button
            onClick={openAdd}
            className="flex items-center justify-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all"
          >
            <Plus className="w-5 h-5" /> Add Unit
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
                New Unit
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
                  onChange={(e) => setActiveCert(allCerts.find((c) => c.id === e.target.value) ?? null)}
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
                  Topic
                </label>
                <select
                  value={activeTopic?.id ?? ''}
                  onChange={(e) =>
                    setActiveTopic(filteredTopics.find((t) => t.id === e.target.value) ?? null)
                  }
                  className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:border-indigo-600 bg-white"
                  required
                >
                  <option value="">Select a topic...</option>
                  {filteredTopics.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
                  Sub Topic
                </label>
                <select
                  value={activeSubTopic?.id ?? ''}
                  onChange={(e) =>
                    setActiveSubTopic(filteredSubTopics.find((s) => s.id === e.target.value) ?? null)
                  }
                  className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:border-indigo-600 bg-white"
                  required
                >
                  <option value="">Select a sub topic...</option>
                  {filteredSubTopics.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
                    Unit Title
                  </label>
                  <input
                    type="text"
                    value={unitForm.title}
                    onChange={(e) => setUnitForm({ ...unitForm, title: e.target.value })}
                    className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:border-indigo-600"
                    placeholder="e.g. Cost Optimization"
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
                    value={unitForm.orderIndex}
                    onChange={(e) => setUnitForm({ ...unitForm, orderIndex: e.target.value === '' ? '' : parseInt(e.target.value) })}
                    onBlur={(e) => { const v = parseInt(e.target.value); setUnitForm({ ...unitForm, orderIndex: isNaN(v) ? 0 : Math.max(0, v) }); }}
                    className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:border-indigo-600"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
                  Description (Optional)
                </label>
                <textarea
                  value={unitForm.description}
                  onChange={(e) => setUnitForm({ ...unitForm, description: e.target.value })}
                  className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:border-indigo-600 h-24"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all disabled:opacity-50"
              >
                Save Unit
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
        {/* Search and filters */}
        <div className="flex flex-col gap-3">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:border-indigo-400 text-sm text-slate-900 bg-white"
              placeholder="Search units..."
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Certification filter */}
            <select
              value={activeCert?.id ?? ''}
              onChange={(e) => {
                setActiveCert(allCerts.find((c) => c.id === e.target.value) ?? null);
              }}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 outline-none focus:border-indigo-400 text-sm bg-white text-slate-600 font-bold"
            >
              <option value="">All Certifications</option>
              {allCerts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
            {/* Topic filter */}
            <select
              value={activeTopic?.id ?? ''}
              onChange={(e) =>
                setActiveTopic(filteredTopics.find((t) => t.id === e.target.value) ?? null)
              }
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 outline-none focus:border-indigo-400 text-sm bg-white text-slate-600 font-bold"
            >
              <option value="">All Topics</option>
              {filteredTopics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
            {/* Subtopic filter */}
            <select
              value={activeSubTopic?.id ?? ''}
              onChange={(e) =>
                setActiveSubTopic(filteredSubTopics.find((s) => s.id === e.target.value) ?? null)
              }
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 outline-none focus:border-indigo-400 text-sm bg-white text-slate-600 font-bold"
            >
              <option value="">All Sub Topics</option>
              {filteredSubTopics.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Result count */}
        <p className="text-sm text-slate-500 font-medium">
          Showing{' '}
          <span className="font-bold text-slate-700">
            {filtered.length === 0
              ? 0
              : Math.min((page - 1) * pageSize + 1, filtered.length)}
            –{Math.min(page * pageSize, filtered.length)}
          </span>{' '}
          of <span className="font-bold text-slate-700">{filtered.length}</span> units
          {filtered.length < units.length && (
            <span className="text-slate-400"> (filtered from {units.length})</span>
          )}
        </p>

        {/* Loading / empty / list */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
            <p className="text-slate-400 font-bold animate-pulse">Loading data...</p>
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-center py-12 text-slate-400 font-bold">
            {allSubTopics.length === 0 ? 'Select a subtopic to view units.' : 'No units found.'}
          </p>
        ) : (
          paginated.map((unit: any) => (
            <div
              key={unit.id}
              className="group flex items-center justify-between p-5 bg-white border border-slate-100 rounded-2xl hover:border-indigo-100 hover:shadow-sm transition-all"
            >
              <div
                className="flex-1 cursor-pointer"
                onClick={() => buildNavigationContextAndNavigate(unit)}
              >
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  {!unit.isActive && (
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-rose-100 text-rose-700">
                      Inactive
                    </span>
                  )}
                </div>
                <h3 className="font-bold text-slate-900 text-base">{unit.title}</h3>
                {unit.description && (
                  <p className="text-sm text-slate-500 line-clamp-1 mt-0.5">{unit.description}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => openEdit(unit)}
                  className="p-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors"
                  aria-label="Edit unit"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setPendingDeleteId(unit.id)}
                  className="p-2 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg transition-colors"
                  aria-label="Delete unit"
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

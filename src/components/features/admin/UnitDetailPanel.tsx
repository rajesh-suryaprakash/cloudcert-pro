/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from 'react';
import { fetchApi } from '../../../api/client';
import { fetchCertifications } from '../../../api/certifications';
import { useSearchParams } from 'react-router-dom';
import { ArrowLeft, Pencil, Trash2, Loader2, CheckCircle2, AlertCircle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAdminNavigation } from '../../../hooks/useAdminNavigation';
import { useKeyboardNavigation } from '../../../hooks/useKeyboardNavigation';
import NavigationControls from './NavigationControls';

interface UnitDetailPanelProps {
  unitId: string;
  onDelete: (unitId: string) => void;
  onBack: (certId?: string, topicId?: string, subtopicId?: string) => void;
}

export default function UnitDetailPanel({ unitId, onDelete, onBack }: UnitDetailPanelProps) {
  const [searchParams] = useSearchParams();
  const [unit, setUnit] = useState<any>(null);
  const [allCerts, setAllCerts] = useState<any[]>([]);
  const [allTopics, setAllTopics] = useState<any[]>([]);
  const [allSubTopics, setAllSubTopics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  };

  // Initialize navigation hook with error handling
  const navigation = useAdminNavigation('units', unitId, {
    onNavigationError: (_error, message) => {
      showToast('error', message);
    },
  });

  // Setup keyboard navigation (disabled during edit mode, modal, or single record)
  useKeyboardNavigation({
    onPrevious: navigation.goPrevious,
    onNext: navigation.goNext,
    enabled: !showEditForm && !showDeleteConfirm,
    isSingleRecord: navigation.total === 1,
  });

  useEffect(() => {
    setShowEditForm(false);

    // Check if we have cached data for optimistic display
    const cached = navigation.getCachedData(unitId);
    if (cached) {
      const cachedUnit = (cached as any).unit;
      const cachedAllCerts = (cached as any).allCerts;
      const cachedAllTopics = (cached as any).allTopics;
      const cachedAllSubTopics = (cached as any).allSubTopics;
      if (cachedUnit) setUnit(cachedUnit);
      if (cachedAllCerts) setAllCerts(cachedAllCerts);
      if (cachedAllTopics) setAllTopics(cachedAllTopics);
      if (cachedAllSubTopics) setAllSubTopics(cachedAllSubTopics);
      // Still fetch fresh data in background
      fetchUnitDetails();
    } else {
      // No cache, fetch normally
      fetchUnitDetails();
    }
    // fetchUnitDetails and navigation are defined inside the component and would cause infinite loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unitId]);

  const fetchUnitDetails = async () => {
    setLoading(true);
    try {
      // Fetch the unit directly by ID
      const fetchedUnit = await fetchApi(`/units/${unitId}`);

      // Fetch certifications and build hierarchy labels
      const certs = await fetchCertifications();
      setAllCerts(certs);

      const topicsAcc: any[] = [];
      const subTopicsAcc: any[] = [];
      let enrichedUnit: any = null;

      for (const cert of certs) {
        const topics = await fetchApi(`/certifications/${cert.id}/topics`);
        for (const topic of topics) {
          topicsAcc.push({ ...topic, _certTitle: cert.title, _certId: cert.id });
          const subtopics = await fetchApi(`/topics/${topic.id}/subtopics`);
          for (const subtopic of subtopics) {
            subTopicsAcc.push({
              ...subtopic,
              _topicTitle: topic.title,
              _topicId: topic.id,
              _certTitle: cert.title,
              _certId: cert.id,
            });
            if (subtopic.id === fetchedUnit.subTopicId) {
              enrichedUnit = {
                ...fetchedUnit,
                _subTopicTitle: subtopic.title,
                _subTopicId: subtopic.id,
                _topicTitle: topic.title,
                _topicId: topic.id,
                _certTitle: cert.title,
                _certId: cert.id,
              };
            }
          }
        }
        if (enrichedUnit) break;
      }

      setAllTopics(topicsAcc);
      setAllSubTopics(subTopicsAcc);
      setUnit(enrichedUnit || fetchedUnit);

      // Cache the data for optimistic navigation
      if (enrichedUnit) {
        navigation.cacheCurrentData({
          unit: enrichedUnit,
          allCerts: certs,
          allTopics: topicsAcc,
          allSubTopics: subTopicsAcc,
        });
      }

      // If navigated with ?edit=true, open edit form immediately
      if (enrichedUnit && searchParams.get('edit') === 'true') {
        setEditForm({
          certId: enrichedUnit._certId || '',
          topicId: enrichedUnit._topicId || '',
          subtopicId: enrichedUnit._subTopicId || '',
          title: enrichedUnit.title || '',
          description: enrichedUnit.description || '',
          orderIndex: enrichedUnit.orderIndex ?? 0,
        });
        setShowEditForm(true);
      }
    } catch (error) {
      console.error('Failed to fetch unit details:', error);
      showToast('error', 'Failed to load unit details');
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = () => {
    setEditForm({
      certId: unit._certId || '',
      topicId: unit._topicId || '',
      subtopicId: unit._subTopicId || '',
      title: unit.title || '',
      description: unit.description || '',
      orderIndex: unit.orderIndex ?? 0,
    });
    setShowEditForm(true);
  };

  const handleCancelEdit = () => {
    setShowEditForm(false);
    setEditForm({});
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await fetchApi(`/units/${unitId}`, {
        method: 'PUT',
        body: JSON.stringify({
          title: editForm.title,
          description: editForm.description,
          orderIndex: editForm.orderIndex,
        }),
      });
      showToast('success', 'Unit updated successfully');
      setShowEditForm(false);
      await fetchUnitDetails();
    } catch (error) {
      console.error('Failed to update unit:', error);
      showToast('error', 'Failed to update unit');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await onDelete(unitId);
      showToast('success', 'Unit deleted successfully');
      setTimeout(() => onBack(unit?._certId, unit?._topicId, unit?._subTopicId), 1500);
    } catch (error: any) {
      showToast('error', error?.message ?? 'Failed to delete unit');
    }
  };

  const filteredTopics = allTopics.filter((t) => t._certId === (editForm.certId || unit?._certId));

  const filteredSubTopics = allSubTopics.filter(
    (s) => s._topicId === (editForm.topicId || unit?._topicId),
  );

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
        <p className="text-slate-400 font-bold animate-pulse">Loading unit details...</p>
      </div>
    );
  }

  if (!unit) {
    return (
      <div className="text-center py-20 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
        <AlertCircle className="w-12 h-12 text-slate-200 mx-auto mb-4" />
        <h3 className="text-lg font-bold text-slate-900">Unit Not Found</h3>
        <p className="text-slate-500 mb-6">The requested unit could not be found.</p>
        <button
          onClick={() => onBack()}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Units
        </button>
      </div>
    );
  }

  return (
    <>
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            className={`fixed top-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-5 py-3 rounded-2xl shadow-xl font-bold text-sm ${toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <AlertCircle className="w-4 h-4" />
            )}
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowDeleteConfirm(false)}
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
              <p className="text-slate-600 mb-6">
                Are you sure you want to delete <span className="font-bold">{unit.title}</span>?
                This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  className="flex-1 px-4 py-3 bg-rose-600 text-white rounded-xl font-bold hover:bg-rose-700 transition-all"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => onBack(unit?._certId, unit?._topicId, unit?._subTopicId)}
          className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-700 font-bold transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Units
        </button>
        <div className="flex items-center gap-2">
          {showEditForm ? (
            <button
              onClick={handleCancelEdit}
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-all"
            >
              <X className="w-4 h-4" /> Cancel
            </button>
          ) : (
            <>
              <button
                onClick={handleEditClick}
                className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all"
              >
                <Pencil className="w-4 h-4" /> Edit
              </button>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-rose-600 text-white rounded-xl font-bold hover:bg-rose-700 shadow-lg shadow-rose-100 transition-all"
              >
                <Trash2 className="w-4 h-4" /> Delete
              </button>
            </>
          )}
        </div>
      </div>

      {/* Navigation Controls */}
      {navigation.context && (
        <div className="mb-6">
          <NavigationControls
            currentIndex={navigation.currentIndex}
            total={navigation.total}
            canGoPrevious={navigation.canGoPrevious}
            canGoNext={navigation.canGoNext}
            onPrevious={navigation.goPrevious}
            onNext={navigation.goNext}
            isLoading={navigation.isLoading}
          />
        </div>
      )}

      <h2 className="text-2xl font-black text-slate-900 mb-6">
        {showEditForm ? 'Edit Unit' : 'Unit Details'}
      </h2>

      {/* Read-Only View */}
      {!showEditForm && (
        <motion.div
          key={unitId}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
          className="bg-slate-50 rounded-2xl p-6 border border-slate-100"
        >
          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-5">
            Unit Info
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
                Certification
              </label>
              <div className="w-full p-3 rounded-xl border border-slate-200 bg-white text-slate-900 font-medium">
                {unit._certTitle || '—'}
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
                Topic
              </label>
              <div className="w-full p-3 rounded-xl border border-slate-200 bg-white text-slate-900 font-medium">
                {unit._topicTitle || '—'}
              </div>
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
                Sub Topic
              </label>
              <div className="w-full p-3 rounded-xl border border-slate-200 bg-white text-slate-900 font-medium">
                {unit._subTopicTitle || '—'}
              </div>
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
                Unit Title
              </label>
              <div className="w-full p-3 rounded-xl border border-slate-200 bg-white text-slate-900 font-medium">
                {unit.title}
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
                Order Index
              </label>
              <div className="w-full p-3 rounded-xl border border-slate-200 bg-white text-slate-900 font-medium">
                {unit.orderIndex ?? 0}
              </div>
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
                Description (Optional)
              </label>
              <div className="w-full p-3 rounded-xl border border-slate-200 bg-white text-slate-900 font-medium min-h-[80px]">
                {unit.description || (
                  <span className="text-slate-400">No description provided.</span>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Edit Form */}
      {showEditForm && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-50 rounded-2xl p-6 border border-slate-100"
        >
          <form onSubmit={handleSaveEdit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
                  Certification
                </label>
                <select
                  value={editForm.certId}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      certId: e.target.value,
                      topicId: '',
                      subtopicId: '',
                    })
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
                  Topic
                </label>
                <select
                  value={editForm.topicId}
                  onChange={(e) =>
                    setEditForm({ ...editForm, topicId: e.target.value, subtopicId: '' })
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
              <div className="space-y-1 md:col-span-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
                  Sub Topic
                </label>
                <select
                  value={editForm.subtopicId}
                  onChange={(e) => setEditForm({ ...editForm, subtopicId: e.target.value })}
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
              <div className="space-y-1 md:col-span-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
                  Unit Title
                </label>
                <input
                  type="text"
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:border-indigo-600 bg-white"
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
                  value={editForm.orderIndex}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      orderIndex: e.target.value === '' ? '' : parseInt(e.target.value),
                    })
                  }
                  onBlur={(e) => {
                    const v = parseInt(e.target.value);
                    setEditForm({ ...editForm, orderIndex: isNaN(v) ? 0 : Math.max(0, v) });
                  }}
                  className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:border-indigo-600 bg-white"
                />
              </div>
              <div className="space-y-1 md:col-span-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
                  Description (Optional)
                </label>
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:border-indigo-600 bg-white h-24"
                  placeholder="Brief description..."
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={saving}
              className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all disabled:opacity-50"
            >
              {saving ? 'Updating...' : 'Update Unit'}
            </button>
          </form>
        </motion.div>
      )}
    </>
  );
}

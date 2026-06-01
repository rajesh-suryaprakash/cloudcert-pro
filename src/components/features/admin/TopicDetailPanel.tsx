/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from 'react';
import { fetchApi } from '../../../api/client';
import { fetchCertifications } from '../../../api/certifications';
import { useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Pencil,
  Trash2,
  Loader2,
  CheckCircle2,
  AlertCircle,
  X,
  ExternalLink,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAdminNavigation } from '../../../hooks/useAdminNavigation';
import { useKeyboardNavigation } from '../../../hooks/useKeyboardNavigation';
import NavigationControls from './NavigationControls';

interface TopicDetailPanelProps {
  topicId: string;
  onDelete: (topicId: string) => void;
  onBack: (certId?: string) => void;
}

export default function TopicDetailPanel({ topicId, onDelete, onBack }: TopicDetailPanelProps) {
  const [searchParams] = useSearchParams();
  const [topic, setTopic] = useState<any>(null);
  const [allCerts, setAllCerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [docUrlError, setDocUrlError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  };

  // Initialize navigation hook with error handling
  const navigation = useAdminNavigation('topics', topicId, {
    onNavigationError: (error, message) => {
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
    const cached = navigation.getCachedData(topicId);
    if (cached) {
      setTopic(cached.topic);
      setAllCerts(cached.allCerts || []);
      // Still fetch fresh data in background
      fetchTopicDetails();
    } else {
      // No cache, fetch normally
      fetchTopicDetails();
    }
    // fetchTopicDetails and navigation are defined inside the component and would cause infinite loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topicId]);

  const fetchTopicDetails = async () => {
    setLoading(true);
    try {
      const certs = await fetchCertifications();
      setAllCerts(certs);

      let foundTopic: any = null;
      for (const cert of certs) {
        const topics = await fetchApi(`/certifications/${cert.id}/topics`);
        const match = topics.find((t: any) => t.id === topicId);
        if (match) {
          foundTopic = { ...match, _certTitle: cert.title, _certId: cert.id };
          break;
        }
      }

      setTopic(foundTopic || null);

      // Cache the data for optimistic navigation
      if (foundTopic) {
        navigation.cacheCurrentData({
          topic: foundTopic,
          allCerts: certs,
        });
      }

      // If navigated with ?edit=true, open edit form immediately
      if (foundTopic && searchParams.get('edit') === 'true') {
        setEditForm({
          certId: foundTopic._certId || '',
          title: foundTopic.title || '',
          description: foundTopic.description || '',
          orderIndex: foundTopic.orderIndex ?? 0,
          docUrl: foundTopic.docUrl || '',
          weightPercentage: foundTopic.weightPercentage ?? 0,
        });
        setDocUrlError(null);
        setShowEditForm(true);
      }
    } catch (error) {
      console.error('Failed to fetch topic details:', error);
      showToast('error', 'Failed to load topic details');
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = () => {
    setEditForm({
      certId: topic._certId || '',
      title: topic.title || '',
      description: topic.description || '',
      orderIndex: topic.orderIndex ?? 0,
      docUrl: topic.docUrl || '',
      weightPercentage: topic.weightPercentage ?? 0,
    });
    setDocUrlError(null);
    setShowEditForm(true);
  };

  const handleCancelEdit = () => {
    setShowEditForm(false);
    setEditForm({});
    setDocUrlError(null);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editForm.docUrl && !editForm.docUrl.startsWith('https://')) {
      setDocUrlError('Documentation URL must start with https://');
      return;
    }
    setSaving(true);
    try {
      await fetchApi(`/topics/${topicId}`, {
        method: 'PUT',
        body: JSON.stringify({ ...editForm, docUrl: editForm.docUrl || null }),
      });
      showToast('success', 'Topic updated successfully');
      setShowEditForm(false);
      await fetchTopicDetails();
    } catch (error) {
      console.error('Failed to update topic:', error);
      showToast('error', 'Failed to update topic');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await onDelete(topicId);
      showToast('success', 'Topic deleted successfully');
      setTimeout(() => onBack(topic?._certId), 1500);
    } catch (error: any) {
      showToast('error', error?.message ?? 'Failed to delete topic');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
        <p className="text-slate-400 font-bold animate-pulse">Loading topic details...</p>
      </div>
    );
  }

  if (!topic) {
    return (
      <div className="text-center py-20 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
        <AlertCircle className="w-12 h-12 text-slate-200 mx-auto mb-4" />
        <h3 className="text-lg font-bold text-slate-900">Topic Not Found</h3>
        <p className="text-slate-500 mb-6">The requested topic could not be found.</p>
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Topics
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
                <h3 className="text-xl font-black text-slate-900">Delete Topic?</h3>
              </div>
              <p className="text-slate-600 mb-6">
                Are you sure you want to delete <span className="font-bold">{topic.title}</span>?
                This will also delete all associated subtopics and questions. This action cannot be
                undone.
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
          onClick={() => onBack(topic?._certId)}
          className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-700 font-bold transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Topics
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
        {showEditForm ? 'Edit Topic' : 'Topic Details'}
      </h2>

      {/* Read-Only View */}
      {!showEditForm && (
        <motion.div
          key={topicId}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
          className="bg-slate-50 rounded-2xl p-6 border border-slate-100"
        >
          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-5">
            Topic Info
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-1 md:col-span-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
                Certification
              </label>
              <div className="w-full p-3 rounded-xl border border-slate-200 bg-white text-slate-900 font-medium">
                {topic._certTitle || '—'}
              </div>
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
                Topic Title
              </label>
              <div className="w-full p-3 rounded-xl border border-slate-200 bg-white text-slate-900 font-medium">
                {topic.title}
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
                Order Index
              </label>
              <div className="w-full p-3 rounded-xl border border-slate-200 bg-white text-slate-900 font-medium">
                {topic.orderIndex ?? 0}
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
                Weight %
              </label>
              <div className="w-full p-3 rounded-xl border border-slate-200 bg-white text-slate-900 font-medium">
                {topic.weightPercentage ?? 0}%
              </div>
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
                Documentation URL (Optional)
              </label>
              <div className="w-full p-3 rounded-xl border border-slate-200 bg-white text-slate-900 font-medium">
                {topic.docUrl ? (
                  <a
                    href={topic.docUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-700 transition-colors"
                  >
                    {topic.docUrl} <ExternalLink className="w-3 h-3 flex-shrink-0" />
                  </a>
                ) : (
                  <span className="text-slate-400">—</span>
                )}
              </div>
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
                Description (Optional)
              </label>
              <div className="w-full p-3 rounded-xl border border-slate-200 bg-white text-slate-900 font-medium min-h-[80px]">
                {topic.description || (
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
              <div className="space-y-1 md:col-span-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
                  Certification
                </label>
                <select
                  value={editForm.certId}
                  onChange={(e) => setEditForm({ ...editForm, certId: e.target.value })}
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
              <div className="space-y-1 md:col-span-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
                  Topic Title
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
                  onChange={(e) => setEditForm({ ...editForm, orderIndex: e.target.value === '' ? '' : parseInt(e.target.value) })}
                  onBlur={(e) => { const v = parseInt(e.target.value); setEditForm({ ...editForm, orderIndex: isNaN(v) ? 0 : Math.max(0, v) }); }}
                  className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:border-indigo-600 bg-white"
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
                  value={editForm.weightPercentage}
                  onChange={(e) => setEditForm({ ...editForm, weightPercentage: e.target.value === '' ? '' : parseFloat(e.target.value) })}
                  onBlur={(e) => { const v = parseFloat(e.target.value); setEditForm({ ...editForm, weightPercentage: isNaN(v) ? 0 : Math.min(100, Math.max(0, v)) }); }}
                  className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:border-indigo-600 bg-white"
                />
              </div>
              <div className="space-y-1 md:col-span-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
                  Documentation URL (Optional)
                </label>
                <input
                  type="text"
                  value={editForm.docUrl}
                  onChange={(e) => {
                    setEditForm({ ...editForm, docUrl: e.target.value });
                    setDocUrlError(
                      e.target.value && !e.target.value.startsWith('https://')
                        ? 'Documentation URL must start with https://'
                        : null,
                    );
                  }}
                  className={`w-full p-3 rounded-xl border outline-none focus:border-indigo-600 bg-white ${docUrlError ? 'border-rose-400' : 'border-slate-200'}`}
                  placeholder="https://..."
                />
                {docUrlError && <p className="text-xs text-rose-500 px-1 mt-1">{docUrlError}</p>}
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
              disabled={saving || !!docUrlError}
              className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all disabled:opacity-50"
            >
              {saving ? 'Updating...' : 'Update Topic'}
            </button>
          </form>
        </motion.div>
      )}
    </>
  );
}

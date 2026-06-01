/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { fetchApi } from '../../../api/client';
import {
  ArrowLeft,
  Pencil,
  Trash2,
  ExternalLink,
  Loader2,
  CheckCircle2,
  AlertCircle,
  X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAdminNavigation } from '../../../hooks/useAdminNavigation';
import { useKeyboardNavigation } from '../../../hooks/useKeyboardNavigation';
import NavigationControls from './NavigationControls';

interface CertificationDetailPanelProps {
  certificationId: string;
  onEdit: (cert: any) => void;
  onDelete: (certId: string) => void;
  onBack: (vendor?: string) => void;
}

export default function CertificationDetailPanel({
  certificationId,
  onEdit: _onEdit,
  onDelete,
  onBack,
}: CertificationDetailPanelProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [cert, setCert] = useState<any>(null);
  const [_stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Initialize navigation hook with error handling
  const navigation = useAdminNavigation('certifications', certificationId, {
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

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    setShowEditForm(false);

    // Check if we have cached data for optimistic display
    const cached = navigation.getCachedData(certificationId);
    if (cached) {
      setCert(cached.cert);
      setStats(cached.stats);
      // Still fetch fresh data in background
      fetchCertificationDetails();
    } else {
      // No cache, fetch normally
      fetchCertificationDetails();
    }
    // fetchCertificationDetails and navigation are defined inside the component and would cause infinite loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [certificationId]);

  const fetchCertificationDetails = async () => {
    setLoading(true);
    try {
      const allCerts = await fetchApi('/certifications');
      const certData = allCerts.find((c: any) => c.id === certificationId);
      if (!certData) {
        setCert(null);
        setLoading(false);
        return;
      }
      setCert(certData);

      const [topics, exams] = await Promise.all([
        fetchApi(`/certifications/${certificationId}/topics`),
        fetchApi(`/certifications/${certificationId}/exams?all=true`),
      ]);

      let totalSubtopics = 0;
      let totalQuestions = 0;
      for (const topic of topics) {
        const subtopics = await fetchApi(`/topics/${topic.id}/subtopics`);
        totalSubtopics += subtopics.length;
        
        // Gracefully handle topics with no questions (returns 400)
        try {
          const questions = await fetchApi(`/topics/${topic.id}/questions`);
          totalQuestions += questions.length;
        } catch (error: any) {
          // If 400 error (no questions), that's okay - just skip counting
          if (error?.status !== 400) {
            throw error; // Re-throw if it's a different error
          }
          // Otherwise, continue with 0 questions for this topic
        }
      }

      setStats({
        topicsCount: topics.length,
        subtopicsCount: totalSubtopics,
        questionsCount: totalQuestions,
        examsCount: exams.length,
        topics,
      });

      // Cache the data for optimistic navigation
      navigation.cacheCurrentData({
        cert: certData,
        stats: {
          topicsCount: topics.length,
          subtopicsCount: totalSubtopics,
          questionsCount: totalQuestions,
          examsCount: exams.length,
          topics,
        },
      });

      // If navigated with ?edit=true, open edit form immediately
      if (searchParams.get('edit') === 'true') {
        setEditForm({
          title: certData.title || '',
          vendor: certData.vendor || '',
          description: certData.description || '',
          level: certData.level || 'Associate',
          url: certData.url || '',
          iconUrl: certData.iconUrl || '',
        });
        setShowEditForm(true);
      }
    } catch (error) {
      console.error('Failed to fetch certification details:', error);
      showToast('error', 'Failed to load certification details');
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = () => {
    setEditForm({
      title: cert.title || '',
      vendor: cert.vendor || '',
      description: cert.description || '',
      level: cert.level || 'Associate',
      url: cert.url || '',
      iconUrl: cert.iconUrl || '',
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
      await fetchApi(`/certifications/${certificationId}`, {
        method: 'PUT',
        body: JSON.stringify(editForm),
      });
      showToast('success', 'Certification updated successfully');
      setShowEditForm(false);
      await fetchCertificationDetails();
    } catch (error) {
      console.error('Failed to update certification:', error);
      showToast('error', 'Failed to update certification');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await onDelete(certificationId);
      showToast('success', 'Certification deleted successfully');
      setTimeout(() => onBack(cert?.vendor), 1500);
    } catch (error: any) {
      showToast('error', error?.message ?? 'Failed to delete certification');
    }
  };

  const _navigateToSection = (section: string) => {
    navigate(`/admin/${section}/${certificationId}`);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
        <p className="text-slate-400 font-bold animate-pulse">Loading certification details...</p>
      </div>
    );
  }

  if (!cert) {
    return (
      <div className="text-center py-20 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
        <AlertCircle className="w-12 h-12 text-slate-200 mx-auto mb-4" />
        <h3 className="text-lg font-bold text-slate-900">Certification Not Found</h3>
        <p className="text-slate-500 mb-6">The requested certification could not be found.</p>
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Certifications
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
                <h3 className="text-xl font-black text-slate-900">Delete Certification?</h3>
              </div>
              <p className="text-slate-600 mb-6">
                Are you sure you want to delete <span className="font-bold">{cert.title}</span>?
                This will also delete all associated topics, subtopics, questions, and exams. This
                action cannot be undone.
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
          onClick={() => onBack(cert?.vendor)}
          className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-700 font-bold transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Certifications
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
        {showEditForm ? 'Edit Certification' : 'Certification Details'}
      </h2>

      {/* Read-Only View */}
      {!showEditForm && (
        <motion.div
          key={certificationId}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
          className="bg-slate-50 rounded-2xl p-6 border border-slate-100 mb-8"
        >
          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-5">
            Certification Info
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Cert Title */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
                Cert Title
              </label>
              <div className="w-full p-3 rounded-xl border border-slate-200 bg-white text-slate-900 font-medium">
                {cert.title}
              </div>
            </div>
            {/* Vendor */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
                Vendor
              </label>
              <div className="w-full p-3 rounded-xl border border-slate-200 bg-white text-slate-900 font-medium">
                {cert.vendor}
              </div>
            </div>
            {/* Level */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
                Level
              </label>
              <div className="w-full p-3 rounded-xl border border-slate-200 bg-white text-slate-900 font-medium">
                {cert.level || 'Not specified'}
              </div>
            </div>
            {/* URL */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
                URL (Optional)
              </label>
              <div className="w-full p-3 rounded-xl border border-slate-200 bg-white text-slate-900 font-medium truncate">
                {cert.url ? (
                  <a
                    href={cert.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-700 transition-colors"
                  >
                    {cert.url} <ExternalLink className="w-3 h-3 flex-shrink-0" />
                  </a>
                ) : (
                  <span className="text-slate-400">—</span>
                )}
              </div>
            </div>
            {/* Icon URL */}
            <div className="space-y-1 md:col-span-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
                Icon URL (Optional)
              </label>
              <div className="w-full p-3 rounded-xl border border-slate-200 bg-white text-slate-900 font-medium">
                {cert.iconUrl || <span className="text-slate-400">—</span>}
              </div>
            </div>
            {/* Description */}
            <div className="space-y-1 md:col-span-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
                Description
              </label>
              <div className="w-full p-3 rounded-xl border border-slate-200 bg-white text-slate-900 font-medium min-h-[80px]">
                {cert.description || (
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
          className="bg-slate-50 rounded-2xl p-6 mb-8 border border-slate-100"
        >
          <form onSubmit={handleSaveEdit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
                  Cert Title
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
                  Vendor
                </label>
                <input
                  type="text"
                  value={editForm.vendor}
                  onChange={(e) => setEditForm({ ...editForm, vendor: e.target.value })}
                  className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:border-indigo-600 bg-white"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
                  Level
                </label>
                <select
                  value={editForm.level}
                  onChange={(e) => setEditForm({ ...editForm, level: e.target.value })}
                  className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:border-indigo-600 bg-white"
                >
                  <option value="Foundational">Foundational</option>
                  <option value="Associate">Associate</option>
                  <option value="Professional">Professional</option>
                  <option value="Expert">Expert</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
                  URL (Optional)
                </label>
                <input
                  type="url"
                  value={editForm.url}
                  onChange={(e) => setEditForm({ ...editForm, url: e.target.value })}
                  className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:border-indigo-600 bg-white"
                  placeholder="https://..."
                />
              </div>
              <div className="space-y-1 md:col-span-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
                  Icon URL (Optional)
                </label>
                <input
                  type="text"
                  value={editForm.iconUrl}
                  onChange={(e) => setEditForm({ ...editForm, iconUrl: e.target.value })}
                  className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:border-indigo-600 bg-white"
                  placeholder="/icons/my-cert.svg"
                />
              </div>
              <div className="space-y-1 md:col-span-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
                  Description
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
              {saving ? 'Updating...' : 'Update Certification'}
            </button>
          </form>
        </motion.div>
      )}
    </>
  );
}

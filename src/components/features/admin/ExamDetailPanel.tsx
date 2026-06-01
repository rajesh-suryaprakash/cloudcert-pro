/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from 'react';
import { fetchApi } from '../../../api/client';
import { useSearchParams } from 'react-router-dom';
import { ArrowLeft, Pencil, Trash2, Loader2, CheckCircle2, AlertCircle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { fetchCertifications } from '../../../api/certifications';
import { useAdminNavigation } from '../../../hooks/useAdminNavigation';
import { useKeyboardNavigation } from '../../../hooks/useKeyboardNavigation';
import NavigationControls from './NavigationControls';

interface ExamDetailPanelProps {
  examId: string;
  onEdit: (exam: any) => void;
  onDelete: (examId: string) => void;
  onBack: (certId?: string) => void;
}

export default function ExamDetailPanel({
  examId,
  onEdit: _onEdit,
  onDelete,
  onBack,
}: ExamDetailPanelProps) {
  const [searchParams] = useSearchParams();
  const [exam, setExam] = useState<any>(null);
  const [allCerts, setAllCerts] = useState<any[]>([]);
  const [topics, setTopics] = useState<any[]>([]);
  const [effectiveWeights, setEffectiveWeights] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Initialize navigation hook with error handling
  const navigation = useAdminNavigation('exams', examId, {
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
    const cached = navigation.getCachedData(examId);
    if (cached) {
      setExam(cached.exam);
      setAllCerts(cached.allCerts || []);
      setTopics(cached.topics || []);
      setEffectiveWeights(cached.effectiveWeights || []);
      // Still fetch fresh data in background
      fetchExamDetails();
    } else {
      // No cache, fetch normally
      fetchExamDetails();
    }
    // fetchExamDetails and navigation are defined inside the component and would cause infinite loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examId]);

  const fetchExamDetails = async () => {
    setLoading(true);
    try {
      const certs = await fetchCertifications();
      setAllCerts(certs);

      let foundExam: any = null;
      let certId: string | null = null;

      for (const cert of certs) {
        const exams = await fetchApi(`/certifications/${cert.id}/exams?all=true`);
        const match = exams.find((e: any) => e.id === examId);
        if (match) {
          foundExam = { ...match, _certTitle: cert.title, _certId: cert.id };
          certId = cert.id;
          break;
        }
      }

      if (!foundExam) {
        setExam(null);
        setLoading(false);
        return;
      }
      setExam(foundExam);

      if (certId) {
        const t = await fetchApi(`/certifications/${certId}/topics`);
        setTopics(t);
        // Load effective weights (derived from topics or explicit override)
        const w = await fetchApi(`/exams/${examId}/effective-topic-weights`).catch(() => null);
        if (w) setEffectiveWeights(w.topics ?? []);
      }

      // Cache the data for optimistic navigation
      navigation.cacheCurrentData({
        exam: foundExam,
        allCerts: certs,
        topics: certId ? await fetchApi(`/certifications/${certId}/topics`) : [],
        effectiveWeights,
      });

      // If navigated with ?edit=true, open edit form immediately after data loads
      if (searchParams.get('edit') === 'true') {
        setEditForm({
          certId: foundExam._certId || '',
          name: foundExam.name || '',
          description: foundExam.description || '',
          duration: foundExam.duration || 120,
          totalQuestions: foundExam.totalQuestions || 50,
          passingScore: foundExam.passingScore || 70,
          questionSelectionStrategy: foundExam.questionSelectionStrategy || 'random',
          isActive: foundExam.isActive !== false,
        });
        setShowEditForm(true);
      }
    } catch (error) {
      console.error('Failed to fetch exam details:', error);
      showToast('error', 'Failed to load exam details');
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = () => {
    setEditForm({
      certId: exam._certId || '',
      name: exam.name || '',
      description: exam.description || '',
      duration: exam.duration || 120,
      totalQuestions: exam.totalQuestions || 50,
      passingScore: exam.passingScore || 70,
      questionSelectionStrategy: exam.questionSelectionStrategy || 'random',
      isActive: exam.isActive !== false,
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
      await fetchApi(`/exams/${examId}`, {
        method: 'PUT',
        // topicWeights intentionally omitted — server derives from topic.weightPercentage
        body: JSON.stringify({ ...editForm, passingScore: 70, topicWeights: {} }),
      });
      showToast('success', 'Exam updated successfully');
      setShowEditForm(false);
      await fetchExamDetails();
    } catch (error) {
      console.error('Failed to update exam:', error);
      showToast('error', 'Failed to update exam');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await onDelete(examId);
      showToast('success', 'Exam deleted successfully');
      setTimeout(() => onBack(exam?._certId), 1500);
    } catch (error: any) {
      showToast('error', error?.message ?? 'Failed to delete exam');
    }
  };

  // Topics for the selected cert in edit form
  const _editTopics = topics.filter(() => true); // already loaded for current cert

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
        <p className="text-slate-400 font-bold animate-pulse">Loading exam details...</p>
      </div>
    );
  }

  if (!exam) {
    return (
      <div className="text-center py-20 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
        <AlertCircle className="w-12 h-12 text-slate-200 mx-auto mb-4" />
        <h3 className="text-lg font-bold text-slate-900">Exam Not Found</h3>
        <p className="text-slate-500 mb-6">The requested exam could not be found.</p>
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Exams
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
                <h3 className="text-xl font-black text-slate-900">Delete Exam?</h3>
              </div>
              <p className="text-slate-600 mb-6">
                Are you sure you want to delete <span className="font-bold">{exam.name}</span>? This
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
          onClick={() => onBack(exam?._certId)}
          className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-700 font-bold transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Exams
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
        {showEditForm ? 'Edit Exam' : 'Exam Details'}
      </h2>

      {/* Read-Only View */}
      {!showEditForm && (
        <motion.div
          key={examId}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
          className="bg-slate-50 rounded-2xl p-6 border border-slate-100"
        >
          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-5">
            Exam Info
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Certification */}
            <div className="space-y-1 md:col-span-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
                Certification
              </label>
              <div className="w-full p-3 rounded-xl border border-slate-200 bg-white text-slate-900 font-medium">
                {exam._certTitle || '—'}
              </div>
            </div>
            {/* Exam Name */}
            <div className="space-y-1 md:col-span-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
                Exam Name
              </label>
              <div className="w-full p-3 rounded-xl border border-slate-200 bg-white text-slate-900 font-medium">
                {exam.name}
              </div>
            </div>
            {/* Duration */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
                Duration (Minutes)
              </label>
              <div className="w-full p-3 rounded-xl border border-slate-200 bg-white text-slate-900 font-medium">
                {exam.duration}
              </div>
            </div>
            {/* Total Questions */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
                Total Questions
              </label>
              <div className="w-full p-3 rounded-xl border border-slate-200 bg-white text-slate-900 font-medium">
                {exam.totalQuestions}
              </div>
            </div>
            {/* Selection Strategy */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
                Selection Strategy
              </label>
              <div className="w-full p-3 rounded-xl border border-slate-200 bg-white text-slate-900 font-medium capitalize">
                {exam.questionSelectionStrategy?.replace(/_/g, ' ') || 'Random'}
              </div>
            </div>
            {/* Derived topic weights preview */}
            {exam.questionSelectionStrategy === 'topic_based' && effectiveWeights.length > 0 && (
              <div className="space-y-2 md:col-span-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
                  Topic Weights (derived from Topic Configuration)
                </label>
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
                  {effectiveWeights.map((t) => (
                    <div key={t.id} className="flex items-center gap-3">
                      <span className="text-sm text-slate-700 flex-1 truncate">{t.title}</span>
                      <div className="w-28 bg-slate-200 rounded-full h-1.5">
                        <div
                          className="bg-indigo-500 h-1.5 rounded-full"
                          style={{ width: `${(t.normalisedWeight * 100).toFixed(1)}%` }}
                        />
                      </div>
                      <span className="text-xs font-bold text-slate-600 w-10 text-right">
                        {(t.normalisedWeight * 100).toFixed(1)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/* Status */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
                Status
              </label>
              <div
                className={`w-full p-3 rounded-xl border border-slate-200 bg-white font-medium ${exam.isActive ? 'text-emerald-600' : 'text-rose-600'}`}
              >
                {exam.isActive ? 'Active (Visible to learners)' : 'Inactive (Hidden from learners)'}
              </div>
            </div>
            {/* Description */}
            <div className="space-y-1 md:col-span-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
                Description (Optional)
              </label>
              <div className="w-full p-3 rounded-xl border border-slate-200 bg-white text-slate-900 font-medium min-h-[80px]">
                {exam.description || (
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
              {/* Certification selector */}
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
                  Exam Name
                </label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:border-indigo-600 bg-white"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
                  Duration (Min)
                </label>
                <input
                  type="number"
                  value={editForm.duration}
                  onChange={(e) => setEditForm({ ...editForm, duration: e.target.value === '' ? '' : parseInt(e.target.value) })}
                  onBlur={(e) => { const v = parseInt(e.target.value); setEditForm({ ...editForm, duration: isNaN(v) ? 15 : Math.min(480, Math.max(15, v)) }); }}
                  className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:border-indigo-600 bg-white"
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
                  value={editForm.totalQuestions}
                  onChange={(e) => setEditForm({ ...editForm, totalQuestions: e.target.value === '' ? '' : parseInt(e.target.value) })}
                  onBlur={(e) => { const v = parseInt(e.target.value); setEditForm({ ...editForm, totalQuestions: isNaN(v) ? 5 : Math.min(500, Math.max(5, v)) }); }}
                  className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:border-indigo-600 bg-white"
                  min="5"
                  max="500"
                  required
                />
              </div>
              <div className="space-y-1 md:col-span-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
                  Selection Strategy
                </label>
                <select
                  value={editForm.questionSelectionStrategy}
                  onChange={(e) =>
                    setEditForm({ ...editForm, questionSelectionStrategy: e.target.value })
                  }
                  className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:border-indigo-600 bg-white"
                >
                  <option value="random">Random Selection</option>
                  <option value="difficulty_balanced">Difficulty Balanced</option>
                  <option value="topic_based">Topic Based (Weighted)</option>
                </select>
              </div>
              {editForm.questionSelectionStrategy === 'topic_based' && (
                <div className="space-y-2 p-4 bg-indigo-50 rounded-2xl border border-indigo-100 md:col-span-2">
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
                  <p className="text-xs text-slate-500 mb-3">
                    Weights are automatically derived from each topic's Weight % setting. Update
                    them in the Topics section.
                  </p>
                  {effectiveWeights.length === 0 ? (
                    <p className="text-xs text-amber-600 font-medium">
                      No topic weights configured. Set Weight % on topics to enable proportional
                      selection.
                    </p>
                  ) : (
                    effectiveWeights.map((t) => (
                      <div key={t.id} className="flex items-center justify-between gap-4 py-1">
                        <span className="text-sm text-slate-700 truncate flex-1">{t.title}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-24 bg-slate-200 rounded-full h-1.5">
                            <div
                              className="bg-indigo-500 h-1.5 rounded-full"
                              style={{ width: `${(t.normalisedWeight * 100).toFixed(1)}%` }}
                            />
                          </div>
                          <span className="text-xs font-bold text-slate-600 w-10 text-right">
                            {(t.normalisedWeight * 100).toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
              <div className="space-y-1 md:col-span-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
                  Description (Optional)
                </label>
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:border-indigo-600 bg-white h-20"
                  placeholder="Brief description..."
                />
              </div>
              <div className="md:col-span-2">
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={editForm.isActive}
                    onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
                    className="w-4 h-4 accent-indigo-600"
                  />
                  <span className="text-sm font-bold text-slate-600">
                    Active (visible to learners)
                  </span>
                </label>
              </div>
            </div>
            <button
              type="submit"
              disabled={saving}
              className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all disabled:opacity-50"
            >
              {saving ? 'Updating...' : 'Update Exam'}
            </button>
          </form>
        </motion.div>
      )}
    </>
  );
}

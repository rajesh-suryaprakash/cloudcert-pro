/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { fetchApi } from '../../../api/client';
import { fetchCertifications } from '../../../api/certifications';
import {
  Plus,
  Trash2,
  ChevronRight,
  Database,
  Loader2,
  X,
  Pencil,
  CheckCircle2,
  Search,
  AlertCircle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { usePagination, paginate } from '../../../hooks/usePagination';
import Pagination from '../../ui/Pagination';

interface CertificationsPanelProps {
  onSelectCert: (cert: any, openEdit?: boolean, ids?: string[]) => void;
}

const EMPTY_FORM = {
  title: '',
  vendor: '',
  description: '',
  level: 'Associate',
  url: '',
  iconUrl: '',
};

export default function CertificationsPanel({ onSelectCert }: CertificationsPanelProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [certs, setCerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [certForm, setCertForm] = useState(EMPTY_FORM);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  // Filter state lives in the URL
  const search = searchParams.get('search') ?? '';
  const filterVendor = searchParams.get('vendor') ?? '';

  const setSearch = (val: string) => {
    const p = new URLSearchParams(searchParams);
    if (val) p.set('search', val);
    else p.delete('search');
    p.delete('page');
    setSearchParams(p, { replace: true });
  };
  const setFilterVendor = (val: string) => {
    const p = new URLSearchParams(searchParams);
    if (val) p.set('vendor', val);
    else p.delete('vendor');
    p.delete('page');
    setSearchParams(p, { replace: true });
  };

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), type === 'error' ? 5000 : 3000);
  };

  useEffect(() => {
    fetchCerts();
  }, []);

  const fetchCerts = async () => {
    setLoading(true);
    try {
      const data = await fetchCertifications();
      setCerts(data);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const vendors = useMemo(
    () => [...new Set(certs.map((c) => c.vendor).filter(Boolean))].sort(),
    [certs],
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return certs.filter((c) => {
      const matchSearch =
        !q || c.title.toLowerCase().includes(q) || (c.description ?? '').toLowerCase().includes(q);
      const matchVendor = !filterVendor || c.vendor === filterVendor;
      return matchSearch && matchVendor;
    });
  }, [certs, search, filterVendor]);

  const { page, pageSize, setPage, setPageSize } = usePagination();

  // Reset to page 1 when filters change
  React.useEffect(() => {
    setPage(1);
  }, [search, filterVendor]); // eslint-disable-line react-hooks/exhaustive-deps

  const paginated = paginate(filtered as any[], page, pageSize);

  const openAdd = () => {
    setCertForm(EMPTY_FORM);
    setShowAddForm(true);
  };

  const openEdit = (cert: any, e: React.MouseEvent) => {
    e.stopPropagation();
    buildNavigationContextAndNavigate(cert, true);
  };

  /**
   * Build navigation context from current filter state and navigate to detail view
   * Encodes filtered IDs and filter state in URL for navigation support
   */
  const buildNavigationContextAndNavigate = (cert: any, openEdit?: boolean) => {
    // Extract filtered certification IDs from current filter state
    const ids = filtered.map((c) => c.id);

    // Build filter state to preserve in navigation context
    const filters: Record<string, string> = {};
    if (search) {
      filters.search = search;
    }
    if (filterVendor) {
      filters.vendor = filterVendor;
    }

    // Pass IDs and filters to parent component
    // The parent will encode these in the URL with proper format:
    // - ids: comma-separated list
    // - nav-prefixed filter parameters (navSearch, navVendor)
    onSelectCert(cert, openEdit, ids);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await fetchApi('/certifications', { method: 'POST', body: JSON.stringify(certForm) });
      setShowAddForm(false);
      setCertForm(EMPTY_FORM);
      fetchCerts();
      showToast('Certification saved successfully');
    } catch (e: any) {
      showToast(e?.message ?? 'Failed to save certification', 'error');
    }
    setLoading(false);
  };

  const deleteCert = async (id: string) => {
    setLoading(true);
    try {
      await fetchApi(`/certifications/${id}`, { method: 'DELETE' });
      fetchCerts();
      showToast('Certification deleted successfully');
    } catch (e: any) {
      const msg = e?.message ?? 'Failed to delete certification';
      showToast(msg, 'error');
    }
    setLoading(false);
    setPendingDeleteId(null);
  };

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
                <h3 className="text-xl font-black text-slate-900">Delete Certification?</h3>
              </div>
              <p className="text-slate-600 mb-6">
                Are you sure you want to delete this certification? This will also delete all
                associated topics, subtopics, questions, and exams. This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setPendingDeleteId(null)}
                  className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={() => deleteCert(pendingDeleteId)}
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

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <h2 className="text-2xl font-black text-slate-900">Certifications Management</h2>
        <button
          onClick={showAddForm ? () => setShowAddForm(false) : openAdd}
          className="flex items-center justify-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all"
        >
          {showAddForm ? <X className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
          {showAddForm ? 'Cancel' : 'Add Cert'}
        </button>
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
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4">
              New Certification
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
                    Cert Title
                  </label>
                  <input
                    type="text"
                    value={certForm.title}
                    onChange={(e) => setCertForm({ ...certForm, title: e.target.value })}
                    className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:border-indigo-600"
                    placeholder="e.g. AWS Solutions Architect"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
                    Vendor
                  </label>
                  <input
                    type="text"
                    list="vendor-suggestions"
                    value={certForm.vendor}
                    onChange={(e) => setCertForm({ ...certForm, vendor: e.target.value })}
                    className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:border-indigo-600"
                    placeholder="e.g. Google, Amazon, Microsoft..."
                    required
                  />
                  <datalist id="vendor-suggestions">
                    {vendors.map((v) => (
                      <option key={v} value={v} />
                    ))}
                    {!vendors.includes('Google') && <option value="Google" />}
                    {!vendors.includes('Amazon') && <option value="Amazon" />}
                    {!vendors.includes('Microsoft') && <option value="Microsoft" />}
                  </datalist>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
                    Level
                  </label>
                  <select
                    value={certForm.level}
                    onChange={(e) => setCertForm({ ...certForm, level: e.target.value })}
                    className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:border-indigo-600"
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
                    value={certForm.url}
                    onChange={(e) => setCertForm({ ...certForm, url: e.target.value })}
                    className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:border-indigo-600"
                    placeholder="https://..."
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
                  Icon URL (Optional)
                </label>
                <input
                  type="url"
                  value={certForm.iconUrl}
                  onChange={(e) => setCertForm({ ...certForm, iconUrl: e.target.value })}
                  className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:border-indigo-600"
                  placeholder="https://..."
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
                  Description
                </label>
                <textarea
                  value={certForm.description}
                  onChange={(e) => setCertForm({ ...certForm, description: e.target.value })}
                  className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:border-indigo-600 h-24"
                  placeholder="Brief description..."
                />
              </div>
              <button
                type="submit"
                className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all"
              >
                Save Certification
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
            {/* Search + filter bar */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:border-indigo-400 text-sm text-slate-900 bg-white"
                  placeholder="Search certifications..."
                />
              </div>
              <select
                value={filterVendor}
                onChange={(e) => setFilterVendor(e.target.value)}
                className="px-3 py-2.5 rounded-xl border border-slate-200 outline-none focus:border-indigo-400 text-sm bg-white text-slate-600 font-bold"
              >
                <option value="">All Vendors</option>
                {vendors.map((v) => (
                  <option key={v} value={v}>
                    {v}
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
              of <span className="font-bold text-slate-700">{filtered.length}</span> certifications
              {filtered.length < certs.length && (
                <span className="text-slate-400"> (filtered from {certs.length})</span>
              )}
            </p>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
                <p className="text-slate-400 font-bold animate-pulse">Loading data...</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-20 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                <Database className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-slate-900">
                  {certs.length === 0 ? 'No Certifications Yet' : 'No results found'}
                </h3>
                <p className="text-slate-500">
                  {certs.length === 0
                    ? 'Add your first cloud certification or use the seed tool.'
                    : 'Try adjusting your search or filters.'}
                </p>
              </div>
            ) : (
              paginated.map((cert) => (
                <div
                  key={cert.id}
                  className="group flex items-center justify-between p-5 bg-white border border-slate-100 rounded-2xl hover:border-indigo-100 hover:shadow-sm transition-all"
                >
                  <div
                    className="flex-1 cursor-pointer"
                    onClick={() => buildNavigationContextAndNavigate(cert)}
                  >
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-bold text-slate-900 text-lg">{cert.title}</h3>
                      <span
                        className={`text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-widest ${cert.vendor === 'Amazon' ? 'bg-orange-100 text-orange-700' : cert.vendor === 'Google' ? 'bg-blue-100 text-blue-700' : cert.vendor === 'Microsoft' ? 'bg-sky-100 text-sky-700' : 'bg-slate-100 text-slate-600'}`}
                      >
                        {cert.vendor}
                      </span>
                    </div>
                    <p className="text-sm text-slate-500 line-clamp-1">
                      {cert.description || 'No description provided.'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => openEdit(cert, e)}
                      className="p-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors"
                      title="Edit"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setPendingDeleteId(cert.id)}
                      className="p-2 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                    <ChevronRight className="text-slate-200 group-hover:text-indigo-600 transition-colors" />
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

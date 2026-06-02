/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from 'react';
import { fetchApi } from '../../../api/client';
import { fetchCertifications } from '../../../api/certifications';
import { Loader2, Save, AlertTriangle, CheckCircle2, Scale } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface DomainWeight {
  id: string;
  domainName: string;
  weightPercentage: number;
}

export default function DomainWeightsPanel() {
  const [certifications, setCertifications] = useState<any[]>([]);
  const [selectedCertId, setSelectedCertId] = useState<string>('');
  const [domains, setDomains] = useState<DomainWeight[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    fetchCertifications().then(setCertifications).catch(console.error);
  }, []);

  useEffect(() => {
    if (selectedCertId) {
      loadDomainWeights(selectedCertId);
    } else {
      setDomains([]);
    }
    // loadDomainWeights is defined inside the component and would cause infinite loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCertId]);

  const loadDomainWeights = async (certificationId: string) => {
    setLoading(true);
    try {
      const response = await fetchApi(`/admin/domain-weights/${certificationId}`);
      setDomains(response.domains || []);
    } catch (e) {
      console.error(e);
      showToast('error', 'Failed to load domain weights');
    }
    setLoading(false);
  };

  const handleWeightChange = (domainId: string, newWeight: number) => {
    setDomains((prev) =>
      prev.map((d) => (d.id === domainId ? { ...d, weightPercentage: newWeight } : d)),
    );
  };

  const calculateTotalWeight = () => {
    return domains.reduce((sum, d) => sum + d.weightPercentage, 0);
  };

  const isValidTotal = () => {
    const total = calculateTotalWeight();
    return Math.abs(total - 100) < 0.01;
  };

  const handleSave = async () => {
    if (!isValidTotal()) {
      showToast('error', 'Total weight must equal 100%');
      return;
    }

    setSaving(true);
    try {
      await fetchApi(`/admin/domain-weights/${selectedCertId}`, {
        method: 'PUT',
        body: JSON.stringify({
          domains: domains.map((d) => ({
            domainName: d.domainName,
            weightPercentage: d.weightPercentage,
          })),
        }),
      });
      showToast('success', 'Domain weights updated successfully');
    } catch (e: any) {
      console.error(e);
      showToast('error', e.message || 'Failed to update domain weights');
    }
    setSaving(false);
  };

  const totalWeight = calculateTotalWeight();
  const isValid = isValidTotal();

  return (
    <>
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            className={`fixed top-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-5 py-3 rounded-2xl shadow-xl font-bold text-sm ${
              toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <AlertTriangle className="w-4 h-4" />
            )}
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900">Domain Weights Management</h2>
          <p className="text-sm text-slate-500 mt-1">
            Configure domain weights for readiness score calculation
          </p>
        </div>
      </div>

      {/* Certification Selector */}
      <div className="mb-6">
        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1 mb-2 block">
          Select Certification
        </label>
        <select
          value={selectedCertId}
          onChange={(e) => setSelectedCertId(e.target.value)}
          className="w-full max-w-md p-3 rounded-xl border border-slate-200 outline-none focus:border-indigo-600 bg-white"
        >
          <option value="">Choose a certification...</option>
          {certifications.map((cert) => (
            <option key={cert.id} value={cert.id}>
              {cert.title}
            </option>
          ))}
        </select>
      </div>

      {/* Domain Weights Editor */}
      {selectedCertId && (
        <div className="space-y-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
              <p className="text-slate-400 font-bold animate-pulse">Loading domain weights...</p>
            </div>
          ) : domains.length === 0 ? (
            <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              <Scale className="w-12 h-12 text-slate-200 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-slate-900">No Domains Found</h3>
              <p className="text-slate-500">
                This certification doesn't have any domain weights configured yet.
              </p>
            </div>
          ) : (
            <>
              {/* Warning Banner */}
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-bold text-amber-900 text-sm mb-1">
                    Cache Invalidation Impact
                  </h4>
                  <p className="text-xs text-amber-700">
                    Updating domain weights will invalidate cached readiness scores for all users
                    who have taken this certification. Scores will be recalculated on their next
                    dashboard visit.
                  </p>
                </div>
              </div>

              {/* Domain Weights Form */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6">
                <div className="space-y-4">
                  {domains.map((domain) => (
                    <div
                      key={domain.id}
                      className="flex items-center justify-between gap-4 p-4 bg-slate-50 rounded-xl"
                    >
                      <div className="flex-1">
                        <label className="font-bold text-slate-900">{domain.domainName}</label>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          value={domain.weightPercentage}
                          onChange={(e) =>
                            handleWeightChange(
                              domain.id,
                              e.target.value === '' ? 0 : parseFloat(e.target.value),
                            )
                          }
                          onBlur={(e) => {
                            const v = parseFloat(e.target.value);
                            handleWeightChange(
                              domain.id,
                              isNaN(v) ? 0 : Math.min(100, Math.max(0, v)),
                            );
                          }}
                          className="w-24 p-2 rounded-lg border border-slate-200 text-right font-bold text-slate-900 outline-none focus:border-indigo-600"
                        />
                        <span className="text-slate-500 font-bold">%</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Total Weight Display */}
                <div className="mt-6 pt-6 border-t border-slate-200">
                  <div className="flex items-center justify-between p-4 bg-slate-100 rounded-xl">
                    <span className="font-bold text-slate-900 text-lg">Total Weight</span>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-2xl font-black ${
                          isValid ? 'text-emerald-600' : 'text-rose-600'
                        }`}
                      >
                        {totalWeight.toFixed(1)}%
                      </span>
                      {isValid ? (
                        <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                      ) : (
                        <AlertTriangle className="w-6 h-6 text-rose-600" />
                      )}
                    </div>
                  </div>
                  {!isValid && (
                    <p className="text-sm text-rose-600 font-bold mt-2 text-center">
                      Total must equal 100% (currently {totalWeight.toFixed(1)}%)
                    </p>
                  )}
                </div>

                {/* Save Button */}
                <button
                  onClick={handleSave}
                  disabled={!isValid || saving}
                  className="w-full mt-6 flex items-center justify-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-5 h-5" />
                      Save Domain Weights
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}

import React from 'react';
import { motion } from 'motion/react';
import { ChevronRight, BookOpen, Heart, Search, BrainCircuit } from 'lucide-react';
import { paginate, type PageSize } from '../../../hooks/usePagination';
import Pagination from '../../ui/Pagination';
import type { Certification } from '../../../types';

export interface CertificationSelectorProps {
  certs: Certification[];
  favorites: Set<string>;
  toggleFavorite: (certId: string, e: React.MouseEvent) => void;
  showFavoritesOnly: boolean;
  setShowFavoritesOnly: (val: boolean) => void;
  certSearch: string;
  setCertSearch: (val: string) => void;
  certPage: number;
  setCertPage: (val: number) => void;
  certPageSize: PageSize;
  setCertPageSize: (val: PageSize) => void;
  onCertSelect: (cert: Certification) => void;
}

export function CertificationSelector({
  certs,
  favorites,
  toggleFavorite,
  showFavoritesOnly,
  setShowFavoritesOnly,
  certSearch,
  setCertSearch,
  certPage,
  setCertPage,
  certPageSize,
  setCertPageSize,
  onCertSelect,
}: CertificationSelectorProps) {
  const filteredCerts = certs
    .filter((c) => {
      if (showFavoritesOnly && !favorites.has(c.id)) return false;
      const q = certSearch.toLowerCase();
      return (
        !q ||
        c.title.toLowerCase().includes(q) ||
        (c.vendor ?? '').toLowerCase().includes(q) ||
        (c.description ?? '').toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      const aFav = favorites.has(a.id) ? 0 : 1;
      const bFav = favorites.has(b.id) ? 0 : 1;
      return aFav - bFav;
    });

  const paginatedCerts = paginate(filteredCerts, certPage, certPageSize);

  const vendorBadgeClass = (vendor: string) =>
    vendor === 'Amazon'
      ? 'bg-orange-100 text-orange-700'
      : vendor === 'Google'
        ? 'bg-blue-100 text-blue-700'
        : 'bg-sky-100 text-sky-700';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-indigo-600" /> Available Certifications
          </h3>
          <button
            onClick={() => {
              setShowFavoritesOnly(!showFavoritesOnly);
              setCertPage(1);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
              showFavoritesOnly
                ? 'bg-rose-100 text-rose-600 border border-rose-200'
                : 'bg-slate-100 text-slate-500 hover:bg-rose-50 hover:text-rose-500 border border-transparent'
            }`}
          >
            <Heart className={`w-3.5 h-3.5 ${showFavoritesOnly ? 'fill-rose-500' : ''}`} />
            Favorites {favorites.size > 0 && `(${favorites.size})`}
          </button>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={certSearch}
            onChange={(e) => {
              setCertSearch(e.target.value);
              setCertPage(1);
            }}
            placeholder="Search certifications..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:border-indigo-400 text-sm bg-white text-slate-900"
          />
        </div>
      </div>

      {filteredCerts.length === 0 ? (
        <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl p-12 text-center space-y-4">
          <BrainCircuit className="w-12 h-12 text-slate-200 mx-auto" />
          <p className="font-bold text-slate-900">
            {certSearch
              ? 'No certifications match your search.'
              : showFavoritesOnly
                ? 'No favorites yet.'
                : 'No certifications available yet.'}
          </p>
          <p className="text-sm text-slate-500">
            {certSearch
              ? 'Try a different search term.'
              : showFavoritesOnly
                ? 'Click the heart icon on any certification to add it to your favorites.'
                : 'Check back later or ask an admin to add some!'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {paginatedCerts.map((cert, i) => {
              const isFav = favorites.has(cert.id);
              return (
                <motion.button
                  key={cert.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  whileHover={{ y: -4, scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => onCertSelect(cert)}
                  className="p-6 bg-white rounded-3xl border border-slate-200 shadow-sm hover:shadow-xl hover:border-indigo-200 text-left transition-all group relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50 rounded-full -mr-12 -mt-12 group-hover:bg-indigo-100 transition-colors" />

                  {/* Favorite Toggle Button */}
                  <button
                    onClick={(e) => toggleFavorite(cert.id, e)}
                    className="absolute top-4 right-4 z-20 p-1.5 rounded-full hover:bg-slate-100 transition-all"
                  >
                    <Heart
                      className={`w-4 h-4 transition-colors ${
                        isFav ? 'fill-rose-500 text-rose-500' : 'text-slate-300 hover:text-rose-500'
                      }`}
                    />
                  </button>

                  <div className="relative z-10">
                    <div className="flex justify-between items-start mb-4">
                      {cert.iconUrl ? (
                        <img
                          src={cert.iconUrl}
                          alt={`${cert.vendor} logo`}
                          className="w-10 h-10 object-contain rounded-lg"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <div
                          className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${vendorBadgeClass(cert.vendor)}`}
                        >
                          {cert.vendor}
                        </div>
                      )}
                      <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-indigo-600 transition-colors mr-6" />
                    </div>
                    {cert.iconUrl && (
                      <div
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest mb-2 ${vendorBadgeClass(cert.vendor)}`}
                      >
                        {cert.vendor}
                      </div>
                    )}
                    <h4 className="text-lg font-bold text-slate-900 line-clamp-2 h-14 pr-4">
                      {cert.title}
                    </h4>
                    <p className="text-sm text-slate-500 mt-2 line-clamp-2">
                      {cert.description ||
                        'Master this certification with our curated question bank.'}
                    </p>
                  </div>
                </motion.button>
              );
            })}
          </div>

          <Pagination
            page={certPage}
            pageSize={certPageSize}
            total={filteredCerts.length}
            onPageChange={setCertPage}
            onPageSizeChange={(s) => {
              setCertPageSize(s);
              setCertPage(1);
            }}
          />
        </div>
      )}
    </div>
  );
}

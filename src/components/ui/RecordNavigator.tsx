import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';

interface RecordNavigatorProps {
  currentId: string;
  onNavigate: (id: string) => void;
  label?: string; // e.g. "Certification", "Exam"
}

/**
 * Reads ?ids=id1,id2,id3 from the URL to determine prev/next records.
 * The list panel encodes the filtered+sorted ID list when navigating to a detail view.
 */
export default function RecordNavigator({
  currentId,
  onNavigate,
  label = 'Record',
}: RecordNavigatorProps) {
  const [searchParams] = useSearchParams();
  const idsParam = searchParams.get('ids');
  const ids = idsParam ? idsParam.split(',').filter(Boolean) : [];

  if (ids.length <= 1) return null;

  const currentIndex = ids.indexOf(currentId);
  if (currentIndex === -1) return null;

  const prevId = currentIndex > 0 ? ids[currentIndex - 1] : null;
  const nextId = currentIndex < ids.length - 1 ? ids[currentIndex + 1] : null;
  const position = `${currentIndex + 1} / ${ids.length}`;

  return (
    <div className="flex items-center gap-1">
      <span className="text-xs text-slate-400 font-medium mr-1">{position}</span>
      <button
        onClick={() => prevId && onNavigate(prevId)}
        disabled={!prevId}
        title={`Previous ${label}`}
        className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      <button
        onClick={() => nextId && onNavigate(nextId)}
        disabled={!nextId}
        title={`Next ${label}`}
        className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}

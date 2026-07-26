import React from 'react';
import { motion } from 'motion/react';
import { Clock, Target, Award, Trophy } from 'lucide-react';

export interface DashboardMetricsProps {
  stats: {
    totalAttempts: number;
    averageScore: number;
    passedExams: number;
    bestScore: number | string;
  };
}

export function DashboardMetrics({ stats }: DashboardMetricsProps) {
  const statItems = [
    {
      label: 'Attempts',
      value: stats.totalAttempts,
      icon: Clock,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      label: 'Avg Score',
      value: `${stats.averageScore}%`,
      icon: Target,
      color: 'text-indigo-600',
      bg: 'bg-indigo-50',
    },
    {
      label: 'Passed',
      value: stats.passedExams,
      icon: Award,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
    },
    {
      label: 'Best Score',
      value: `${Number(stats.bestScore).toFixed(2)}%`,
      icon: Trophy,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {statItems.map((stat, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.08 }}
          className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-2"
        >
          <div
            className={`${stat.bg} ${stat.color} w-8 h-8 rounded-lg flex items-center justify-center`}
          >
            <stat.icon className="w-4 h-4" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              {stat.label}
            </p>
            <p className="text-xl font-black text-slate-900">{stat.value}</p>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

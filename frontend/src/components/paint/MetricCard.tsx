import React from "react";
import { LucideIcon } from 'lucide-react';

type Props = {
  label: string;
  value: string;
  subtitle?: string;
  icon?: LucideIcon;
  iconBg?: string;
  iconColor?: string;
};

export const MetricCard: React.FC<Props> = ({
  label, value, subtitle, icon: Icon, iconBg = "bg-slate-100", iconColor = "text-slate-700",
}) => {
  return (
    <div className="rounded-lg border p-4 bg-white flex items-end justify-between gap-4 h-32">
      <div className="flex-1 min-w-0">
        <div className="text-sm text-slate-500 mb-1">{label}</div>
        <div className="text-3xl font-bold text-gray-900 mb-2">{value}</div>
        {subtitle && <div className="text-xs text-slate-500">{subtitle}</div>}
      </div>
      {Icon && (
        <Icon className={`w-12 h-12 flex-shrink-0 ${iconColor}`} />
      )}
    </div>
  );
};

import { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  label: string;
  value: string;
  subtitle: string;
  subtitleColor?: string;
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
}

export function MetricCard({ 
  label, 
  value, 
  subtitle, 
  subtitleColor = 'text-[#4a5565]',
  icon: Icon, 
  iconBg, 
  iconColor 
}: MetricCardProps) {
  return (
    <div className="bg-white rounded-[14px] border border-[#e5e7eb] shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1),0px_1px_2px_-1px_rgba(0,0,0,0.1)] p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-[#4a5565] text-[14px] leading-[20px]">{label}</p>
          <p className="text-[#101828] text-[30px] font-bold leading-[36px] mt-2">
            {value}
          </p>
        </div>
        <div className={`${iconBg} rounded-[10px] w-12 h-12 flex items-center justify-center`}>
          <Icon className={`w-6 h-6 ${iconColor}`} />
        </div>
      </div>
      <p className={`${subtitleColor} text-[12px] leading-[16px]`}>
        {subtitle}
      </p>
    </div>
  );
}

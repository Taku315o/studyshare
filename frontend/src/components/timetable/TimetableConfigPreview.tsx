import { formatWeekdayList } from '@/lib/timetable/config';
import type { TimetableConfig } from '@/types/timetable';

type TimetableConfigPreviewProps = {
  config: TimetableConfig;
  className?: string;
};

export default function TimetableConfigPreview({ config, className }: TimetableConfigPreviewProps) {
  return (
    <div className={className}>
      <p className="text-xs text-slate-500">曜日: {formatWeekdayList(config.weekdays)}</p>
      <div className="mt-2 overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full min-w-[420px] text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-xs text-slate-500">
              <th className="px-3 py-2">時限</th>
              <th className="px-3 py-2">表示名</th>
              <th className="px-3 py-2">開始</th>
              <th className="px-3 py-2">終了</th>
            </tr>
          </thead>
          <tbody>
            {config.periods.map((period) => (
              <tr key={period.period} className="border-t border-slate-100">
                <td className="px-3 py-2 font-semibold text-slate-700">{period.period}</td>
                <td className="px-3 py-2 text-slate-700">{period.label}</td>
                <td className="px-3 py-2 text-slate-700">{period.startTime}</td>
                <td className="px-3 py-2 text-slate-700">{period.endTime}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

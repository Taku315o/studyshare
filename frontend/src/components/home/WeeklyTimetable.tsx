import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import type { Course, TimetableDay, TimetableItem } from '@/lib/mock/homeMock';

export type WeeklyTimetableProps = {
  courses: Course[];
  timetableItems: TimetableItem[];
};

const days: TimetableDay[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

const dayLabels: Record<TimetableDay, string> = {
  Mon: '月',
  Tue: '火',
  Wed: '水',
  Thu: '木',
  Fri: '金',
};

const timeSlots = ['9:00', '10:45', '13:10', '14:55'];

const colorStyles: Record<TimetableItem['colorToken'], string> = {
  blue: 'border-blue-200 bg-blue-50 text-blue-900',
  indigo: 'border-indigo-200 bg-indigo-50 text-indigo-900',
  emerald: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  amber: 'border-amber-200 bg-amber-50 text-amber-900',
  rose: 'border-rose-200 bg-rose-50 text-rose-900',
};

export default function WeeklyTimetable({ courses, timetableItems }: WeeklyTimetableProps) {
  const courseMap = new Map(courses.map((course) => [course.id, course]));

  return (
    <Card>
      <CardHeader>
        <CardTitle>今週の時間割</CardTitle>
      </CardHeader>

      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] table-fixed border-separate border-spacing-0 text-sm">
            <thead>
              <tr>
                <th className="w-20 border-b border-slate-200 px-2 py-2 text-left font-semibold text-slate-500" />
                {days.map((day) => (
                  <th
                    key={day}
                    className="border-b border-slate-200 px-2 py-2 text-center font-semibold text-slate-600"
                  >
                    {dayLabels[day]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {timeSlots.map((slot) => (
                <tr key={slot}>
                  <td className="border-b border-slate-100 px-2 py-3 align-top text-slate-500">{slot}</td>
                  {days.map((day) => {
                    const item = timetableItems.find((entry) => entry.day === day && entry.start === slot);
                    const course = item ? courseMap.get(item.courseId) : null;

                    return (
                      <td key={`${day}-${slot}`} className="h-28 border-b border-slate-100 px-2 py-2 align-top">
                        {item && course ? (
                          <div
                            className={[
                              'rounded-xl border p-2.5 shadow-sm',
                              colorStyles[item.colorToken],
                            ].join(' ')}
                          >
                            <p className="line-clamp-1 text-sm font-semibold">{course.title}</p>
                            <p className="mt-1 text-xs">{course.professor}</p>
                            <p className="mt-1 text-xs opacity-80">
                              {item.start} - {item.end}
                            </p>
                          </div>
                        ) : (
                          <div className="h-full rounded-xl border border-dashed border-slate-200 bg-slate-50/60" />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

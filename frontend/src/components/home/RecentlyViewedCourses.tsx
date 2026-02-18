import { BookOpenText, MessageSquareText, NotebookPen, Star } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import type { Course } from '@/lib/mock/homeMock';

export type RecentlyViewedCoursesProps = {
  courses: Course[];
};

export default function RecentlyViewedCourses({ courses }: RecentlyViewedCoursesProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>最近見た授業</CardTitle>
      </CardHeader>

      <CardContent>
        <div className="flex gap-3 overflow-x-auto pb-1 md:grid md:grid-cols-3 md:overflow-visible">
          {courses.map((course) => (
            <article
              key={course.id}
              className="min-w-[230px] rounded-xl border border-slate-200 bg-white p-3 shadow-sm md:min-w-0"
            >
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                <BookOpenText className="h-3.5 w-3.5" />
                {course.faculty}
              </div>

              <h3 className="mt-2 line-clamp-2 text-sm font-semibold text-slate-900">{course.title}</h3>
              <p className="mt-1 text-xs text-slate-500">{course.professor}</p>

              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-600">
                <span className="inline-flex items-center gap-1">
                  <Star className="h-3.5 w-3.5 text-amber-500" fill="currentColor" />
                  {course.rating.toFixed(1)}
                </span>
                <span className="inline-flex items-center gap-1">
                  <MessageSquareText className="h-3.5 w-3.5" />
                  {course.reviewCount}
                </span>
                <span className="inline-flex items-center gap-1">
                  <NotebookPen className="h-3.5 w-3.5" />
                  {course.noteCount}
                </span>
              </div>
            </article>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

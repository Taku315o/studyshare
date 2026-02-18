import { MessageSquareText, NotebookPen, Star } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import type { Course } from '@/lib/mock/homeMock';

export type PopularCoursesProps = {
  courses: Course[];
};

export default function PopularCourses({ courses }: PopularCoursesProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>人気の授業</CardTitle>
      </CardHeader>

      <CardContent>
        <div className="grid gap-3 md:grid-cols-3">
          {courses.map((course) => (
            <article key={course.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <h3 className="line-clamp-2 text-sm font-semibold text-slate-900">{course.title}</h3>
              <p className="mt-1 text-xs text-slate-500">
                {course.professor} ・ {course.faculty}
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-700">
                <span className="inline-flex items-center gap-1 font-semibold">
                  <Star className="h-3.5 w-3.5 text-amber-500" fill="currentColor" />
                  {course.rating.toFixed(1)}
                </span>
                <span className="inline-flex items-center gap-1">
                  <MessageSquareText className="h-3.5 w-3.5" />
                  {course.reviewCount} 件
                </span>
                <span className="inline-flex items-center gap-1">
                  <NotebookPen className="h-3.5 w-3.5" />
                  {course.noteCount} 件
                </span>
              </div>
            </article>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

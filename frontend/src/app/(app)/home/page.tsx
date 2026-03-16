import HotPosts, { MiniBoard } from '@/components/home/HotPosts';
import NewReviews from '@/components/home/NewReviews';
import PopularCourses from '@/components/home/PopularCourses';
import RecentlyViewedCourses from '@/components/home/RecentlyViewedCourses';
import WeeklyTimetable from '@/components/home/WeeklyTimetable';
import { homeMockData } from '@/lib/mock/homeMock';

export default function HomePage() {
  const courses = Array.isArray(homeMockData.courses) ? homeMockData.courses : [];
  const timetableItems = Array.isArray(homeMockData.timetableItems) ? homeMockData.timetableItems : [];
  const reviews = Array.isArray(homeMockData.reviews) ? homeMockData.reviews : [];
  const hotPosts = Array.isArray(homeMockData.hotPosts) ? homeMockData.hotPosts : [];
  const miniBoardPosts = Array.isArray(homeMockData.miniBoardPosts) ? homeMockData.miniBoardPosts : [];
  const recentlyViewedCourseIds = Array.isArray(homeMockData.recentlyViewedCourseIds)
    ? homeMockData.recentlyViewedCourseIds
    : [];
  const popularCourseIds = Array.isArray(homeMockData.popularCourseIds) ? homeMockData.popularCourseIds : [];

  const courseMap = new Map(courses.map((course) => [course.id, course]));
  const recentlyViewedCourses = recentlyViewedCourseIds
    .map((id) => courseMap.get(id))
    .filter((course): course is NonNullable<typeof course> => Boolean(course));
  const popularCourses = popularCourseIds
    .map((id) => courseMap.get(id))
    .filter((course): course is NonNullable<typeof course> => Boolean(course));

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <WeeklyTimetable courses={courses} timetableItems={timetableItems} />
        <NewReviews reviews={reviews} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <RecentlyViewedCourses courses={recentlyViewedCourses} />
        <HotPosts posts={hotPosts} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <PopularCourses courses={popularCourses} />
        <MiniBoard posts={miniBoardPosts} />
      </div>
    </div>
  );
}

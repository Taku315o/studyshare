export type Course = {
  id: string;
  title: string;
  professor: string;
  faculty: string;
  rating: number;
  reviewCount: number;
  noteCount: number;
};

export type TimetableDay = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri';

export type TimetableItem = {
  day: TimetableDay;
  start: string;
  end: string;
  courseId: string;
  colorToken: 'blue' | 'indigo' | 'emerald' | 'amber' | 'rose';
};

export type Review = {
  id: string;
  userName: string;
  courseTitle: string;
  rating: number;
  text: string;
  createdAt: string;
};

export type HotPost = {
  id: string;
  userName: string;
  title: string;
  excerpt: string;
};

export type MiniBoardPost = {
  id: string;
  userName: string;
  courseTitle: string;
  body: string;
};

export type HomeMockData = {
  courses: Course[];
  timetableItems: TimetableItem[];
  reviews: Review[];
  hotPosts: HotPost[];
  miniBoardPosts: MiniBoardPost[];
  recentlyViewedCourseIds: string[];
  popularCourseIds: string[];
};

export const homeMockData: HomeMockData = {
  courses: [
    {
      id: 'course-1',
      title: '線形代数学',
      professor: '山田 太郎',
      faculty: '工学部',
      rating: 4.6,
      reviewCount: 38,
      noteCount: 56,
    },
    {
      id: 'course-2',
      title: 'データベース概論',
      professor: '鈴木 一郎',
      faculty: '情報学部',
      rating: 4.4,
      reviewCount: 52,
      noteCount: 47,
    },
    {
      id: 'course-3',
      title: '認知心理学',
      professor: '佐藤 花子',
      faculty: '文学部',
      rating: 4.2,
      reviewCount: 28,
      noteCount: 31,
    },
    {
      id: 'course-4',
      title: 'マーケティング入門',
      professor: '高橋 健',
      faculty: '経済学部',
      rating: 4.1,
      reviewCount: 44,
      noteCount: 33,
    },
    {
      id: 'course-5',
      title: 'Webプログラミング',
      professor: '中村 亮',
      faculty: '情報学部',
      rating: 4.8,
      reviewCount: 64,
      noteCount: 72,
    },
    {
      id: 'course-6',
      title: '統計学基礎',
      professor: '伊藤 翔',
      faculty: '理学部',
      rating: 4.3,
      reviewCount: 41,
      noteCount: 39,
    },
  ],
  timetableItems: [
    { day: 'Mon', start: '9:00', end: '10:30', courseId: 'course-1', colorToken: 'blue' },
    { day: 'Tue', start: '9:00', end: '10:30', courseId: 'course-2', colorToken: 'indigo' },
    { day: 'Wed', start: '10:45', end: '12:15', courseId: 'course-3', colorToken: 'emerald' },
    { day: 'Thu', start: '10:45', end: '12:15', courseId: 'course-5', colorToken: 'blue' },
    { day: 'Fri', start: '9:00', end: '10:30', courseId: 'course-6', colorToken: 'rose' },
    { day: 'Mon', start: '13:10', end: '14:40', courseId: 'course-4', colorToken: 'amber' },
    { day: 'Tue', start: '14:55', end: '16:25', courseId: 'course-5', colorToken: 'blue' },
    { day: 'Fri', start: '13:10', end: '14:40', courseId: 'course-2', colorToken: 'indigo' },
  ],
  reviews: [
    {
      id: 'review-1',
      userName: '佐藤さん',
      courseTitle: 'データベース概論',
      rating: 4.5,
      text: '中間はやや難しめ。演習を先に解いておくと理解しやすいです。',
      createdAt: '30分前',
    },
    {
      id: 'review-2',
      userName: '田中さん',
      courseTitle: '認知心理学',
      rating: 4.2,
      text: 'レポート中心で、講義ノートを毎回まとめると高評価を狙えます。',
      createdAt: '1時間前',
    },
    {
      id: 'review-3',
      userName: '鈴木さん',
      courseTitle: '線形代数学',
      rating: 4.7,
      text: '試験は過去問に近い形式でした。行列計算を重点的に復習推奨。',
      createdAt: '2時間前',
    },
  ],
  hotPosts: [
    {
      id: 'post-1',
      userName: '小川さん',
      title: '線形代数学の最終対策メモを共有',
      excerpt: '特に固有値まわりの頻出パターンをまとめました。',
    },
    {
      id: 'post-2',
      userName: '中野さん',
      title: 'Webプログラミング課題のペア募集',
      excerpt: '来週提出のSPA課題、一緒にレビューし合える方を探しています。',
    },
  ],
  miniBoardPosts: [
    {
      id: 'board-1',
      userName: '吉田さん',
      courseTitle: '統計学基礎',
      body: '推定の回で使ったスライド、見返しポイントありますか？',
    },
    {
      id: 'board-2',
      userName: '森さん',
      courseTitle: '認知心理学',
      body: '次回レポートのテーマ選びで迷っています。',
    },
    {
      id: 'board-3',
      userName: '山口さん',
      courseTitle: 'マーケティング入門',
      body: 'ケース分析の参考文献おすすめがあれば知りたいです。',
    },
  ],
  recentlyViewedCourseIds: ['course-2', 'course-3', 'course-5'],
  popularCourseIds: ['course-5', 'course-1', 'course-6'],
};

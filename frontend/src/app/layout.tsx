//layout.tsx
//app routerにおけるアプリ全体のレイアウトを定義するファイル
//AuthProviderで全体を囲むことで、どのページでも認証情報にアクセスできるようにしている。
// また、Toasterコンポーネントを配置し、通知機能を有効にしています。
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { Toaster } from 'react-hot-toast';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'StudyShare - 大学生の授業・時間割・ノート・コミュニティ',
  description: '大学生向けに授業情報、時間割、ノート、口コミ、コミュニティをまとめて使えるプラットフォーム。',
  icons: {
    icon: [
      { url: '/studyshare_logo.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico', sizes: 'any' },
    ],
    shortcut: '/favicon.ico',
    apple: '/studyshare_logo.svg',
  },
};

/**
 * Next.js root layout that wraps all pages with the shared providers and metadata configuration.
 *
 * @param children - Page content to render within the layout shell.
 * @returns HTML document markup including providers shared across routes.
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className={inter.className}>
        <AuthProvider>
          {children}
          <Toaster position="top-right" />
        </AuthProvider>
      </body>
    </html>
  );
}

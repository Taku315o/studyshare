//AssignmentForm.tsx
// このコンポーネントは、課題のタイトル、説明、およびオプションの画像をユーザーが入力し、送信するためのフォームを提供します。
// フォームの送信時に、画像がアップロードされ（存在する場合）、課題データがAPI経由で作成されます。
// 認証、フォームバリデーション、画像プレビュー、および通知処理も含まれています。
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { uploadImage, createAssignment, setAuthToken } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

type FormData = {
  title: string;
  description: string;
  university: string;
  faculty: string;
  department: string;
  course_name: string;
  teacher_name: string;
};

/**
 * Form component that lets authenticated users submit new assignments with optional images.
 *
 * @returns JSX element rendering the assignment submission form.
 */
export default function AssignmentForm() {
  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>();
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const { getAccessToken } = useAuth();
  const router = useRouter();




  // 画像プレビュー表示
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    
    if (file) {
      // ファイル形式チェック
      if (!['image/jpeg', 'image/png'].includes(file.type)) {
        toast.error('JPEGまたはPNG形式の画像のみアップロード可能です');
        return;
      }
      
      // ファイルサイズチェック (5MB以下)
      if (file.size > 5 * 1024 * 1024) {
        toast.error('ファイルサイズは5MB以下にしてください');
        return;
      }
      
      setImage(file);
      
      // プレビュー表示
      const reader = new FileReader();
      reader.onload = () => {//onloadイベントはファイルの読み込みが正常に完了した時に発生するイベント。アロー関数で読み込み完了時に呼び出されるようになっている。
        setImagePreview(reader.result as string);//reader.resultはFileReader オブジェクトの result プロパティを参照している。stringはtyoescriptの型アサーションで、reader.resultがstring型であることを明示している。
      };//これはsetImagePreview関数を用いて、imagePreviewの状態を更新している。
      reader.readAsDataURL(file);
    } else {
      setImage(null);
      setImagePreview(null);
    }
  };




  // 投稿処理
  const onSubmit = async (data: FormData) => {
    try {
      setUploading(true);
      
      // 認証トークン取得
      const token = await getAccessToken();
      console.log('[AssignmentForm] Token取得:', token ? `${token.substring(0, 20)}...` : 'null');
      
      if (!token) {
        toast.error('ログインが必要です');
        router.push('/auth/login');
        return;
      }
      
      // トークンをセット
      setAuthToken(token);
      console.log('[AssignmentForm] AuthToken設定完了');
      
      let imageUrl = null;
      
      // 画像アップロード
      if (image) {
        console.log('[AssignmentForm] 画像アップロード開始');
        const uploadResult = await uploadImage(image);
        imageUrl = uploadResult.url;
        console.log('[AssignmentForm] 画像アップロード完了:', imageUrl);
      }
      
      const university = data.university.trim();
      const faculty = data.faculty.trim();
      const department = data.department.trim();
      const courseName = data.course_name.trim();
      const teacherName = data.teacher_name.trim();

      // 課題投稿 送信payload
      await createAssignment({
        title: data.title,
        description: data.description,
        image_url: imageUrl ?? undefined,
        ...(university ? { university } : {}),
        ...(faculty ? { faculty } : {}),
        ...(department ? { department } : {}),
        ...(courseName ? { course_name: courseName } : {}),
        ...(teacherName ? { teacher_name: teacherName } : {}),
      });
      
      toast.success('課題を投稿しました');
      reset();
      setImage(null);
      setImagePreview(null);
      
      // トップページにリダイレクト
      router.push('/');
    } catch (error) {
      console.error('投稿エラー:', error);
      toast.error('投稿に失敗しました');
    } finally {
      setUploading(false);
    }
  };






  
  return (
    // フォーム要素。送信時に handleSubmit(onSubmit) を呼び出す
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* タイトル入力フィールド */}
      <div>
        <label htmlFor="title" className="block text-sm font-medium text-blue-100/80">
          タイトル
        </label>
        <input
          id="title"
          type="text"
          // react-hook-form の register 関数でフォームコントロールを登録
          // 'title' はフォームデータ内のキー名
          // { required: '必須項目です' } はバリデーションルール
          {...register('title', { required: '必須項目です' })}
          className="mt-1 block w-full rounded-2xl border border-white/15 bg-white/10 px-4 py-2.5 text-white placeholder:text-blue-100/50 shadow-sm focus:border-white/30 focus:outline-none focus:ring-2 focus:ring-white/30"
        />
        {/* タイトル入力のエラーメッセージ表示 */}
        {errors.title && (
          <p className="mt-1 text-sm text-red-300">{errors.title.message}</p>
        )}
      </div>

      {/* 説明入力フィールド */}
      <div>
        <label htmlFor="description" className="block text-sm font-medium text-blue-100/80">
          説明
        </label>
        <textarea
          id="description"
          rows={4}
          // react-hook-form の register 関数でフォームコントロールを登録
          // 'description' はフォームデータ内のキー名
          // { required: '必須項目です' } はバリデーションルール
          {...register('description', { required: '必須項目です' })}
          className="mt-1 block w-full rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-white placeholder:text-blue-100/50 shadow-sm focus:border-white/30 focus:outline-none focus:ring-2 focus:ring-white/30"
        />
        {/* 説明入力のエラーメッセージ表示 */}
        {errors.description && (
          <p className="mt-1 text-sm text-red-300">{errors.description.message}</p>
        )}
      </div>

      {/* 大学入力フィールド */}
      <div>
        <label htmlFor="university" className="block text-sm font-medium text-blue-100/80">
          大学名
        </label>
        <input
          id="university"
          type="text"
          {...register('university')}
          className="mt-1 block w-full rounded-2xl border border-white/15 bg-white/10 px-4 py-2.5 text-white placeholder:text-blue-100/50 shadow-sm focus:border-white/30 focus:outline-none focus:ring-2 focus:ring-white/30"
        />
      </div>

      {/* 学部入力フィールド */}
      <div>
        <label htmlFor="faculty" className="block text-sm font-medium text-blue-100/80">
          学部
        </label>
        <input
          id="faculty"
          type="text"
          {...register('faculty')}
          className="mt-1 block w-full rounded-2xl border border-white/15 bg-white/10 px-4 py-2.5 text-white placeholder:text-blue-100/50 shadow-sm focus:border-white/30 focus:outline-none focus:ring-2 focus:ring-white/30"
        />
      </div>

      {/* 学科入力フィールド */}
      <div>
        <label htmlFor="department" className="block text-sm font-medium text-blue-100/80">
          学科
        </label>
        <input
          id="department"
          type="text"
          {...register('department')}
          className="mt-1 block w-full rounded-2xl border border-white/15 bg-white/10 px-4 py-2.5 text-white placeholder:text-blue-100/50 shadow-sm focus:border-white/30 focus:outline-none focus:ring-2 focus:ring-white/30"
        />
      </div>

      {/* 講義名入力フィールド */}
      <div>
        <label htmlFor="course_name" className="block text-sm font-medium text-blue-100/80">
          講義名
        </label>
        <input
          id="course_name"
          type="text"
          {...register('course_name')}
          className="mt-1 block w-full rounded-2xl border border-white/15 bg-white/10 px-4 py-2.5 text-white placeholder:text-blue-100/50 shadow-sm focus:border-white/30 focus:outline-none focus:ring-2 focus:ring-white/30"
        />
      </div>

      {/* 教員名入力フィールド */}
      <div>
        <label htmlFor="teacher_name" className="block text-sm font-medium text-blue-100/80">
          教員名
        </label>
        <input
          id="teacher_name"
          type="text"
          {...register('teacher_name')}
          className="mt-1 block w-full rounded-2xl border border-white/15 bg-white/10 px-4 py-2.5 text-white placeholder:text-blue-100/50 shadow-sm focus:border-white/30 focus:outline-none focus:ring-2 focus:ring-white/30"
        />
      </div>

      {/* 画像アップロードフィールド */}
      <div>
        <label htmlFor="image" className="block text-sm font-medium text-blue-100/80">
          画像（任意）
        </label>
        <input
          id="image"
          type="file"
          // 受け付けるファイル形式をJPEGとPNGに限定
          accept="image/jpeg, image/png"
          // ファイルが選択されたときに handleImageChange 関数を呼び出す
          onChange={handleImageChange}
          className="mt-1 block w-full text-sm text-blue-100/70 file:mr-4 file:rounded-2xl file:border file:border-white/15 file:bg-white/10 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white/90 hover:file:bg-white/20"
        />
        {/* 画像プレビュー表示 */}
        {imagePreview && (
          <div className="mt-2">
            <Image src={imagePreview} alt="Preview" width={160} height={160} className="h-40 w-auto object-cover rounded-2xl border border-white/10" />
          </div>
        )}
      </div>

      {/* 送信ボタン */}
      <div>
        <button
          type="submit"
          // uploading が true の場合はボタンを無効化
          disabled={uploading}
          className="w-full rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 transition-all duration-200 hover:bg-blue-500 hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-white/30 disabled:opacity-50"
        >
          {/* uploading の状態によってボタンのテキストを変更 */}
          {uploading ? '投稿中...' : '投稿する'}
        </button>
      </div>
    </form>
  );
}

// AssignmentForm.tsx
// コントラスト問題 + ラベル問題だけ修正（レイアウト/構造/挙動は一切変更なし）
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
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>();
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const { getAccessToken } = useAuth();
  const router = useRouter();

  // ====== UI: contrast + label only ======
  const labelClass =
    'block text-xs font-medium tracking-wide text-white/70';
  const inputClass =
    'mt-1 block w-full rounded-2xl px-4 py-2.5 text-white ' +
    'placeholder:text-white/35 ' +
    'bg-white/10 border border-white/15 backdrop-blur-xl ' +
    'shadow-[inset_0_1px_0_rgba(255,255,255,0.10)] ' +
    'focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-white/30';
  const textareaClass =
    'mt-1 block w-full rounded-2xl px-4 py-3 text-white ' +
    'placeholder:text-white/35 ' +
    'bg-white/10 border border-white/15 backdrop-blur-xl ' +
    'shadow-[inset_0_1px_0_rgba(255,255,255,0.10)] ' +
    'focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-white/30';
  const errorTextClass = 'mt-1 text-sm text-red-300';
  // ======================================

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
      reader.onload = () => {
        setImagePreview(reader.result as string);
      };
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
      console.log(
        '[AssignmentForm] Token取得:',
        token ? `${token.substring(0, 20)}...` : 'null'
      );

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
        <label htmlFor="title" className={labelClass}>
          タイトル
        </label>
        <input
          id="title"
          type="text"
          {...register('title', { required: '必須項目です' })}
          className={inputClass}
          placeholder="例）第3回 データ構造 レポート"
        />
        {errors.title && (
          <p className={errorTextClass}>{errors.title.message}</p>
        )}
      </div>

      {/* 説明入力フィールド */}
      <div>
        <label htmlFor="description" className={labelClass}>
          説明
        </label>
        <textarea
          id="description"
          rows={4}
          {...register('description', { required: '必須項目です' })}
          className={textareaClass}
          placeholder="内容 / 共有したいポイント / 注意点など"
        />
        {errors.description && (
          <p className={errorTextClass}>{errors.description.message}</p>
        )}
      </div>

      {/* 大学入力フィールド */}
      <div>
        <label htmlFor="university" className={labelClass}>
          大学名
        </label>
        <input
          id="university"
          type="text"
          {...register('university')}
          className={inputClass}
          placeholder="例）専修大学"
        />
      </div>

      {/* 学部入力フィールド */}
      <div>
        <label htmlFor="faculty" className={labelClass}>
          学部
        </label>
        <input
          id="faculty"
          type="text"
          {...register('faculty')}
          className={inputClass}
          placeholder="例）ネットワーク情報学部"
        />
      </div>

      {/* 学科入力フィールド */}
      <div>
        <label htmlFor="department" className={labelClass}>
          学科
        </label>
        <input
          id="department"
          type="text"
          {...register('department')}
          className={inputClass}
          placeholder="例）ネットワーク情報学科"
        />
      </div>

      {/* 講義名入力フィールド */}
      <div>
        <label htmlFor="course_name" className={labelClass}>
          講義名
        </label>
        <input
          id="course_name"
          type="text"
          {...register('course_name')}
          className={inputClass}
          placeholder="例）アルゴリズムとデータ構造2"
        />
      </div>

      {/* 教員名入力フィールド */}
      <div>
        <label htmlFor="teacher_name" className={labelClass}>
          教員名
        </label>
        <input
          id="teacher_name"
          type="text"
          {...register('teacher_name')}
          className={inputClass}
          placeholder="例）太田先生"
        />
      </div>

      {/* 画像アップロードフィールド */}
      <div>
        <label htmlFor="image" className={labelClass}>
          画像（任意）
        </label>
        <input
          id="image"
          type="file"
          accept="image/jpeg, image/png"
          onChange={handleImageChange}
          className={
            'mt-1 block w-full text-sm text-white/65 ' +
            'file:mr-4 file:rounded-2xl file:border file:border-white/15 ' +
            'file:bg-white/10 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white/90 ' +
            'hover:file:bg-white/20'
          }
        />
        {imagePreview && (
          <div className="mt-2">
            <Image
              src={imagePreview}
              alt="Preview"
              width={160}
              height={160}
              className="h-40 w-auto rounded-2xl border border-white/10 object-cover"
            />
          </div>
        )}
      </div>

      {/* 送信ボタン（指定外なので変更なし） */}
      <div>
        <button
          type="submit"
          disabled={uploading}
          className="w-full rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 transition-all duration-200 hover:bg-blue-500 hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-white/30 disabled:opacity-50"
        >
          {uploading ? '投稿中...' : '投稿する'}
        </button>
      </div>
    </form>
  );
}

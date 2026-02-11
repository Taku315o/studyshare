import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env.development') });
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY は必須です');
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const ASSIGNMENTS_BUCKET = 'assignments';
const SEED_ASSETS_DIR = path.resolve(__dirname, './assets');
const SEED_USER_DEFINITIONS = [
  { email: 'student@example.com', password: 'password123', role: 'student' as const },
  { email: 'admin@example.com', password: 'password123', role: 'admin' as const },
];

interface SeedImage {
  fileName: string;
  ext: string;
  mimeType: string;
  buffer: Buffer;
}

interface AssignmentTemplate {
  title: string;
  description: string;
  university: string;
  faculty: string;
  department: string;
  course_name: string;
  teacher_name: string;
}

interface SeedUser {
  id: string;
  email: string;
  role: 'student' | 'admin';
}

const assignmentTemplates: AssignmentTemplate[] = [
  {
    title: '専修大学 微分積分A 第3回レポート',
    description: '極限計算の基礎問題。教科書 p.42-45 の問2,4,7 を解く。',
    university: '専修大学',
    faculty: 'ネットワーク情報学部',
    department: 'ネットワーク情報学科',
    course_name: '微分積分A',
    teacher_name: '山田 太郎',
  },
  {
    title: '専修大学 線形代数I 週次課題',
    description: '固有値と固有ベクトルの導出。2x2行列3問。',
    university: '専修大学',
    faculty: 'ネットワーク情報学部',
    department: 'ネットワーク情報学科',
    course_name: '線形代数I',
    teacher_name: '鈴木 一郎',
  },
  {
    title: '専修大学 情報倫理 ミニレポート',
    description: 'SNS利用におけるプライバシー問題を事例ベースで考察。',
    university: '専修大学',
    faculty: 'ネットワーク情報学部',
    department: 'ネットワーク情報学科',
    course_name: '情報倫理',
    teacher_name: '佐藤 花子',
  },
  {
    title: '専修大学 データベース演習 SQL課題',
    description: '集約関数とJOINを使ったクエリを5本作成。',
    university: '専修大学',
    faculty: 'ネットワーク情報学部',
    department: 'ネットワーク情報学科',
    course_name: 'データベース演習',
    teacher_name: '高橋 健',
  },
  {
    title: '専修大学 経済学入門 レポート1',
    description: '需要供給曲線のシフト要因について600字で説明。',
    university: '専修大学',
    faculty: '経済学部',
    department: '経済学科',
    course_name: '経済学入門',
    teacher_name: '中村 隆',
  },
  {
    title: '専修大学 マクロ経済学I 課題',
    description: 'GDPギャップと財政政策の関係を図示して解説。',
    university: '専修大学',
    faculty: '経済学部',
    department: '経済学科',
    course_name: 'マクロ経済学I',
    teacher_name: '小林 直樹',
  },
  {
    title: '専修大学 統計学基礎 小テスト対策',
    description: '確率分布と期待値の演習問題10問。',
    university: '専修大学',
    faculty: '経済学部',
    department: '経済学科',
    course_name: '統計学基礎',
    teacher_name: '伊藤 真理',
  },
  {
    title: '専修大学 民法総則 判例要約',
    description: '意思表示に関する判例を1件選び、争点を要約。',
    university: '専修大学',
    faculty: '法学部',
    department: '法律学科',
    course_name: '民法総則',
    teacher_name: '渡辺 恒一',
  },
  {
    title: '専修大学 憲法I 課題レポート',
    description: '表現の自由と公共の福祉の関係を800字で論述。',
    university: '専修大学',
    faculty: '法学部',
    department: '法律学科',
    course_name: '憲法I',
    teacher_name: '松本 綾子',
  },
  {
    title: '専修大学 行政法A 事例問題',
    description: '行政裁量の逸脱濫用が問題となる事例を検討。',
    university: '専修大学',
    faculty: '法学部',
    department: '法律学科',
    course_name: '行政法A',
    teacher_name: '山口 翔',
  },
  {
    title: '専修大学 プログラミング基礎 実装課題',
    description: 'TypeScriptで再帰アルゴリズムを1つ実装。',
    university: '専修大学',
    faculty: 'ネットワーク情報学部',
    department: 'ネットワーク情報学科',
    course_name: 'プログラミング基礎',
    teacher_name: '清水 大輔',
  },
  {
    title: '専修大学 プロジェクト演習 中間提出',
    description: '要件定義書と画面遷移図を提出する。',
    university: '専修大学',
    faculty: 'ネットワーク情報学部',
    department: 'ネットワーク情報学科',
    course_name: 'プロジェクト演習',
    teacher_name: '井上 未来',
  },
  {
    title: '明治大学 情報処理概論 演習1',
    description: '計算量解析の基本問題。オーダー比較を3問。',
    university: '明治大学',
    faculty: '理工学部',
    department: '情報科学科',
    course_name: '情報処理概論',
    teacher_name: '青木 翔太',
  },
  {
    title: '明治大学 データ構造 課題2',
    description: '二分探索木の挿入・削除を図付きで説明。',
    university: '明治大学',
    faculty: '理工学部',
    department: '情報科学科',
    course_name: 'データ構造',
    teacher_name: '石田 美咲',
  },
  {
    title: '明治大学 経営学基礎 レポート',
    description: '国内企業1社を選び、競争優位の要因を分析。',
    university: '明治大学',
    faculty: '経営学部',
    department: '経営学科',
    course_name: '経営学基礎',
    teacher_name: '藤田 亮',
  },
  {
    title: '明治大学 マーケティング論 ミニ課題',
    description: '4P分析を使って新商品提案を作成。',
    university: '明治大学',
    faculty: '経営学部',
    department: '経営学科',
    course_name: 'マーケティング論',
    teacher_name: '岡田 彩',
  },
];

function getMimeType(ext: string): string {
  const normalized = ext.toLowerCase();
  if (normalized === '.jpg' || normalized === '.jpeg') return 'image/jpeg';
  if (normalized === '.png') return 'image/png';
  throw new Error(`未対応の画像拡張子です: ${ext}`);
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u3040-\u30ff\u3400-\u9fbf\u4e00-\u9fff]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}


//指定ディレクトリ(SEED_ASSETS_DIR)から画像ファイル（JPG、JPEG、PNG）を読み込み、メモリ上のバッファとして返す
async function loadSeedImages(): Promise<SeedImage[]> {
  const entries = await fs.readdir(SEED_ASSETS_DIR, { withFileTypes: true });
  const imageEntries = entries.filter((entry) => entry.isFile());

  const images: SeedImage[] = [];

  for (const entry of imageEntries) {
    const ext = path.extname(entry.name).toLowerCase();
    if (!['.jpg', '.jpeg', '.png'].includes(ext)) continue;

    const fullPath = path.join(SEED_ASSETS_DIR, entry.name);
    const buffer = await fs.readFile(fullPath);

    images.push({
      fileName: entry.name,
      ext,
      mimeType: getMimeType(ext),
      buffer,
    });
  }

  if (images.length === 0) {
    throw new Error(`seed画像が見つかりません: ${SEED_ASSETS_DIR}`);
  }

  console.log(`画像読み込み完了: ${images.length}件`);
  return images;
}


//Supabaseの全ユーザーから、事前に決めたメールアドレスの人(SEED_USER_DEFINITIONS)だけ探し出してID付きで返す
async function listSeedAuthUsers(): Promise<Array<{ id: string; email: string }>> {
  const users: Array<{ id: string; email: string }> = [];
  let page = 1;
  const perPage = 200;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    const fetched = data.users
      .filter((user) => user.email && SEED_USER_DEFINITIONS.some((seedUser) => seedUser.email === user.email))
      .map((user) => ({ id: user.id, email: user.email as string }));

    users.push(...fetched);

    if (data.users.length < perPage) break;
    page += 1;
  }

  return users;
}

//
async function removeSeedStorageObjects(userIds: string[]): Promise<void> {
  for (const userId of userIds) {
    const { data: files, error: listError } = await supabase.storage
      .from(ASSIGNMENTS_BUCKET)
      .list(`seed/${userId}`, { limit: 1000, offset: 0 });

    if (listError) throw listError;
    if (!files || files.length === 0) continue;

    const targetPaths = files
      .filter((file) => file.name && !file.name.endsWith('/'))
      .map((file) => `seed/${userId}/${file.name}`);

    if (targetPaths.length === 0) continue;

    const { error: removeError } = await supabase.storage
      .from(ASSIGNMENTS_BUCKET)
      .remove(targetPaths);

    if (removeError) throw removeError;
  }
}

async function cleanupSeedData(): Promise<void> {
  console.log('既存seedデータをクリーンアップ中...');
  const seedAuthUsers = await listSeedAuthUsers();
  const userIds = seedAuthUsers.map((user) => user.id);

  if (userIds.length > 0) {
    await removeSeedStorageObjects(userIds);

    const { error: assignmentDeleteError } = await supabase
      .from('assignments')
      .delete()
      .in('user_id', userIds);

    if (assignmentDeleteError) throw assignmentDeleteError;

    const { error: profileDeleteError } = await supabase
      .from('users')
      .delete()
      .in('id', userIds);

    if (profileDeleteError) throw profileDeleteError;

    for (const user of seedAuthUsers) {
      const { error: authDeleteError } = await supabase.auth.admin.deleteUser(user.id);
      if (authDeleteError) throw authDeleteError;
    }
  }

  console.log(`クリーンアップ完了: 対象ユーザー ${userIds.length}件`);
}

async function createSeedUsers(): Promise<Record<'student' | 'admin', SeedUser>> {
  console.log('seedユーザーを作成中...');
  const createdUsers: SeedUser[] = [];

  for (const definition of SEED_USER_DEFINITIONS) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: definition.email,
      password: definition.password,
      email_confirm: true,
      user_metadata: { role: definition.role } //Supabaseのユーザーメタデータにroleを設定
    });

    if (error || !data.user) {
      throw error ?? new Error(`ユーザー作成に失敗: ${definition.email}`);
    }

    const user = data.user;

    const { error: profileError } = await supabase.from('users').upsert(
      {
        id: user.id,
        email: definition.email,
        role: definition.role,
      },
      { onConflict: 'id' }
    );

    if (profileError) throw profileError;

    createdUsers.push({ id: user.id, email: definition.email, role: definition.role });
  }

  const student = createdUsers.find((user) => user.role === 'student');
  const admin = createdUsers.find((user) => user.role === 'admin');

  if (!student || !admin) {
    throw new Error('seedユーザー生成に失敗しました');
  }

  console.log('seedユーザー作成完了');
  return { student, admin };
}

async function uploadSeedImage(
  userId: string,
  assignmentTitle: string,
  index: number,
  image: SeedImage
): Promise<string> {
  const objectPath = `seed/${userId}/${slugify(assignmentTitle)}-${index + 1}${image.ext}`;

  const { error: uploadError } = await supabase.storage
    .from(ASSIGNMENTS_BUCKET)
    .upload(objectPath, image.buffer, {
      contentType: image.mimeType,
      upsert: true,
    });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from(ASSIGNMENTS_BUCKET).getPublicUrl(objectPath);
  return data.publicUrl;
}

async function upsertUniversityMasters(templates: AssignmentTemplate[]): Promise<void> {
  console.log('大学マスタをupsert中...');
  const universities = [...new Set(templates.map((item) => item.university.trim()))].map((name) => ({ name }));

  const { error: universityUpsertError } = await supabase
    .from('universities')
    .upsert(universities, { onConflict: 'name', ignoreDuplicates: true });

  if (universityUpsertError) throw universityUpsertError;

  const universityNames = universities.map((item) => item.name);
  const { data: universityRows, error: universitySelectError } = await supabase
    .from('universities')
    .select('id,name')
    .in('name', universityNames);

  if (universitySelectError || !universityRows) {
    throw universitySelectError ?? new Error('universities取得に失敗しました');
  }

  const universityMap = new Map(universityRows.map((row) => [row.name, row.id]));

  const facultyPairs = [...new Set(templates.map((item) => `${item.university}|||${item.faculty}`))];
  const facultiesToUpsert = facultyPairs.map((pair) => {
    const [universityName, facultyName] = pair.split('|||');
    const universityId = universityMap.get(universityName);

    if (!universityId) {
      throw new Error(`university_idが見つかりません: ${universityName}`);
    }

    return { university_id: universityId, name: facultyName };
  });

  const { error: facultyUpsertError } = await supabase
    .from('faculties')
    .upsert(facultiesToUpsert, { onConflict: 'university_id,name', ignoreDuplicates: true });

  if (facultyUpsertError) throw facultyUpsertError;

  const { data: facultyRows, error: facultySelectError } = await supabase
    .from('faculties')
    .select('id,name,university_id')
    .in('university_id', facultiesToUpsert.map((row) => row.university_id));

  if (facultySelectError || !facultyRows) {
    throw facultySelectError ?? new Error('faculties取得に失敗しました');
  }

  const facultyMap = new Map<string, string>();
  for (const row of facultyRows) {
    facultyMap.set(`${row.university_id}|||${row.name}`, row.id);
  }

  const departmentPairs = [...new Set(templates.map((item) => `${item.university}|||${item.faculty}|||${item.department}`))];
  const departmentsToUpsert = departmentPairs.map((pair) => {
    const [universityName, facultyName, departmentName] = pair.split('|||');
    const universityId = universityMap.get(universityName);

    if (!universityId) {
      throw new Error(`university_idが見つかりません: ${universityName}`);
    }

    const facultyId = facultyMap.get(`${universityId}|||${facultyName}`);
    if (!facultyId) {
      throw new Error(`faculty_idが見つかりません: ${facultyName}`);
    }

    return { faculty_id: facultyId, name: departmentName };
  });

  const { error: departmentUpsertError } = await supabase
    .from('departments')
    .upsert(departmentsToUpsert, { onConflict: 'faculty_id,name', ignoreDuplicates: true });

  if (departmentUpsertError) throw departmentUpsertError;

  console.log('大学マスタupsert完了');
}

async function seedAssignments(studentUserId: string, images: SeedImage[]): Promise<void> {
  console.log('課題データを生成中...');

  const assignments = [];

  for (let index = 0; index < assignmentTemplates.length; index += 1) {
    const template = assignmentTemplates[index];
    const image = images[index % images.length];
    const imageUrl = await uploadSeedImage(studentUserId, template.title, index, image);

    assignments.push({
      ...template,
      image_url: imageUrl,
      user_id: studentUserId,
    });
  }

  const { error } = await supabase.from('assignments').insert(assignments);

  if (error) throw error;

  console.log(`課題データ投入完了: ${assignments.length}件`);
}

async function verifyAndLogSummary(studentUserId: string): Promise<void> {
  const { count: seededCount, error: countError } = await supabase
    .from('assignments')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', studentUserId);

  if (countError) throw countError;

  const { data: rows, error: rowsError } = await supabase
    .from('assignments')
    .select('university,image_url')
    .eq('user_id', studentUserId);

  if (rowsError || !rows) {
    throw rowsError ?? new Error('summary取得に失敗しました');
  }

  const universityCount = rows.reduce<Record<string, number>>((acc, row) => {
    const key = row.university ?? '(none)';
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  const imageUrlMissing = rows.filter((row) => !row.image_url).length;
  const expectedTotal = assignmentTemplates.length;
  const requiredUniversities = ['専修大学', '明治大学'];

  console.log('--- Seed Summary ---');
  console.log(`seed課題件数: ${seededCount}`);
  console.log(`大学別件数: ${JSON.stringify(universityCount)}`);
  console.log(`image_url欠損: ${imageUrlMissing}`);

  if (seededCount !== expectedTotal) {
    throw new Error(`課題件数が不正です。expected=${expectedTotal}, actual=${seededCount}`);
  }

  for (const university of requiredUniversities) {
    if (!universityCount[university]) {
      throw new Error(`大学データが不足しています: ${university}`);
    }
  }

  if (imageUrlMissing > 0) {
    throw new Error(`image_url欠損があります: ${imageUrlMissing}`);
  }
}

async function main(): Promise<void> {
  try {
    console.log('seed開始');

    const images = await loadSeedImages();
    await cleanupSeedData();
    const users = await createSeedUsers();

    await upsertUniversityMasters(assignmentTemplates);
    await seedAssignments(users.student.id, images);
    await verifyAndLogSummary(users.student.id);

    console.log('seed完了');
  } catch (error) {
    console.error('seed失敗:', error);
    process.exitCode = 1;
  }
}

void main();

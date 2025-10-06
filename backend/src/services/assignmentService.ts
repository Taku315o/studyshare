import { supabaseAdmin as supabase } from '../lib/supabase';
//データベースのassignmentsテーブルに対する具体的な操作（作成、検索、削除）を実装している。
// 削除処理では、管理者でないユーザーが他人の課題を削除できないように、権限チェックも行う。
interface AssignmentData {
  title: string;
  description: string;
  image_url?: string | null;
  user_id: string;
}

// 課題を作成
export const createAssignment = async (data: AssignmentData) => {
  const { data: assignment, error } = await supabase
    .from('assignments')
    .insert([data])
    .select()
    .single();
  
  if (error) {
    console.error('課題作成エラー:', error);
    throw new Error('課題の作成に失敗しました');
  }
  
  return assignment;
};

// 課題を検索
export const searchAssignments = async (query: string) => {
  try {
    const { data, error } = await supabase
      .rpc('search_assignments', { search_query: query });
    
    if (error) {
      console.error('検索エラー:', error);
      throw new Error('課題の検索に失敗しました');
    }
    
    return data || [];
  } catch (error) {
    console.error('検索処理エラー:', error);
    throw new Error('課題の検索処理に失敗しました');
  }
};

// 課題を削除
export const deleteAssignment = async (id: string, userId: string, isAdmin: boolean) => {
  // 管理者でない場合、自分の課題のみ削除可能
  if (!isAdmin) {
    const { data: assignment, error: checkError } = await supabase
      .from('assignments')
      .select('user_id')
      .eq('id', id)
      .single();
    
    if (checkError || !assignment) {
      throw new Error('課題が見つかりません');
    }
    
    if (assignment.user_id !== userId) {
      throw new Error('この課題を削除する権限がありません');
    }
  }
  
  // 課題の削除
  const { error } = await supabase
    .from('assignments')
    .delete()
    .eq('id', id);
  
  if (error) {
    console.error('削除エラー:', error);
    throw new Error('課題の削除に失敗しました');
  }
  
  return { success: true };
};

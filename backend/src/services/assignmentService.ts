import { supabaseAdmin as supabase } from '../lib/supabase';
//データベースのassignmentsテーブルに対する具体的な操作（作成、検索、削除）を実装している。
// 削除処理では、管理者でないユーザーが他人の課題を削除できないように、権限チェックも行う。
interface AssignmentData {
  title: string;
  description: string;
  image_url?: string | null;
  user_id: string;
}

/**
 * Creates a new assignment record in Supabase using the provided payload.
 *
 * @param data - The assignment fields including title, description, optional image URL, and the authoring user ID.
 * @returns The created assignment row returned from Supabase.
 * @throws When Supabase returns an error while inserting the assignment.
 */
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

/**
 * Executes the `search_assignments` stored procedure to fetch assignments that match the query string.
 *
 * @param query - Free-form text used to search the title and description of assignments.
 * @returns A list of assignments matching the search query or an empty array when nothing matches.
 * @throws When Supabase fails to execute the remote procedure call or another runtime error occurs.
 */
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

/**
 * Deletes an assignment while enforcing that non-admin users can only delete their own records.
 *
 * @param id - The identifier of the assignment to delete.
 * @param userId - The ID of the user making the request.
 * @param isAdmin - Flag indicating whether the requesting user has administrator privileges.
 * @returns An object indicating the deletion completed successfully.
 * @throws When the assignment is not found, the user lacks permission, or Supabase fails to delete the record.
 */
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

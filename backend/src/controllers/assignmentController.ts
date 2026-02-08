//assignmentController.ts
// This file contains the controller logic for handling assignment-related requests.
//課題に関するリクエスト（作成、検索、削除）を処理するコントローラー。
// リクエストから必要なデータを取り出し、assignmentServiceの関数を呼び出して実際の処理を依頼する。
import { Request, Response } from 'express';
import { createAssignment, searchAssignments, deleteAssignment } from '../services/assignmentService';

/**
 * Handles assignment creation requests by validating the payload and delegating persistence to the service layer.
 *
 * @param req - Express request containing the assignment data and authenticated user information.
 * @param res - Express response used to return the created assignment or an error.
 * @returns A promise that resolves when the HTTP response has been sent.
 */
export const createAssignmentController = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      title,
      description,
      image_url,
      university,
      faculty,
      department,
      course_name,
      teacher_name,
    } = req.body;
    const user = req.user;

    if (!user) {
      res.status(401).json({ error: '認証が必要です' });
      return;
    }

    if (!title || !description) {
      res.status(400).json({ error: 'タイトルと説明は必須です' });
      return;
    }

    const newAssignment = await createAssignment({
      title,
      description,
      image_url,
      university,
      faculty,
      department,
      course_name,
      teacher_name,
      user_id: user.id,
    });

    res.status(201).json(newAssignment);
  } catch (error: any) {
    console.error('課題作成コントローラーエラー:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Searches assignments using the provided query string and responds with matching results.
 *
 * @param req - Express request containing the search query in the query string.
 * @param res - Express response used to return matching assignments or an error message.
 * @returns A promise that resolves when the response is sent.
 */
export const searchAssignmentsController = async (req: Request, res: Response): Promise<void> => {
  try {
    const query = req.query.query as string;
    
    if (!query) {
      // クエリがない場合は空の結果を返すか、全件返すか選択
      // ここでは空の結果を返す
      res.status(200).json([]);
      return;
    }

    const assignments = await searchAssignments(query);
    res.status(200).json(assignments);
  } catch (error: any) {
    console.error('課題検索コントローラーエラー:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Deletes an assignment identified by the request parameter while enforcing authorization rules.
 *
 * @param req - Express request that includes the assignment ID parameter and authenticated user context.
 * @param res - Express response used to acknowledge deletion or communicate an error.
 * @returns A promise that resolves when the response is issued.
 */
export const deleteAssignmentController = async (req: Request, res: Response): Promise<void> => {
  try {
    const rawId = req.params.id;
    const id = Array.isArray(rawId) ? rawId[0] : rawId;
    const user = req.user;

    if (!user) {
      res.status(401).json({ error: '認証が必要です' });
      return;
    }

    // サービス層で権限チェックも行う
    if (!id) {
      res.status(400).json({ error: '課題IDが必要です' });
      return;
    }

    const result = await deleteAssignment(id, user.id, user.role === 'admin');
    
    res.status(200).json(result);
  } catch (error: any) {
    console.error('課題削除コントローラーエラー:', error);
    res.status(error.message.includes('権限がありません') ? 403 : 500)
       .json({ error: error.message });
  }
};

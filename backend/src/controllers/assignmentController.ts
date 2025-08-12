//assignmentController.ts
// This file contains the controller logic for handling assignment-related requests.
//課題に関するリクエスト（作成、検索、削除）を処理するコントローラー。
// リクエストから必要なデータを取り出し、assignmentServiceの関数を呼び出して実際の処理を依頼する。
import { Request, Response } from 'express';
import { createAssignment, searchAssignments, deleteAssignment } from '../services/assignmentService';

// 課題作成
  // req (Request) - 受信したHTTPリクエスト
  // res (Response) - 送信するHTTPレスポンス
export const createAssignmentController = async (req: Request, res: Response) => {
  try {
    const { title, description, image_url } = req.body;
    const user = req.user;

    if (!user) {
      return res.status(401).json({ error: '認証が必要です' });
    }

    if (!title || !description) {
      return res.status(400).json({ error: 'タイトルと説明は必須です' });
    }

    const newAssignment = await createAssignment({
      title,
      description,
      image_url,
      user_id: user.id,
    });

    res.status(201).json(newAssignment);
  } catch (error: any) {
    console.error('課題作成コントローラーエラー:', error);
    res.status(500).json({ error: error.message });
  }
};

// 課題検索
export const searchAssignmentsController = async (req: Request, res: Response) => {
  try {
    const query = req.query.query as string;
    
    if (!query) {
      // クエリがない場合は空の結果を返すか、全件返すか選択
      // ここでは空の結果を返す
      return res.status(200).json([]);
    }

    const assignments = await searchAssignments(query);
    res.status(200).json(assignments);
  } catch (error: any) {
    console.error('課題検索コントローラーエラー:', error);
    res.status(500).json({ error: error.message });
  }
};

// 課題削除
export const deleteAssignmentController = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = req.user;

    if (!user) {
      return res.status(401).json({ error: '認証が必要です' });
    }

    // サービス層で権限チェックも行う
    const result = await deleteAssignment(id, user.id, user.role === 'admin');
    
    res.status(200).json(result);
  } catch (error: any) {
    console.error('課題削除コントローラーエラー:', error);
    res.status(error.message.includes('権限がありません') ? 403 : 500)
       .json({ error: error.message });
  }
};
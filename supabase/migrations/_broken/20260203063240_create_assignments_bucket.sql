-- assignmentsバケットの作成
INSERT INTO storage.buckets (id, name, public)
VALUES ('assignments', 'assignments', true)
ON CONFLICT (id) DO NOTHING;

-- 誰でも画像を閲覧できるようにする（公開バケット用ポリシー）
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'assignments' );
# Supabase Data Operations

最終更新: 2026-03-06

このドキュメントは、`studyshare` における `migration / seed / snippet / 管理ジョブ` の責務分離を固定するための運用規約です。  
結論から言うと、**schema を作るものと、運用データを入れるものを分離する**。これを今後の原則にします。

seed の投入手順、CSV 正本、関連 scripts の使い方は `docs/supabase_seeds.md` を参照。

## 結論

### 1. データ分類

`studyshare` の Supabase データは、今後必ず以下の 3 種類に分類して扱う。

| 分類 | 定義 | 代表例 | 主な投入手段 |
| --- | --- | --- | --- |
| 不変に近い参照マスタ | アプリ全体の参照起点になる。更新頻度は低いが、schema ではない | `universities` | `seed` + `管理ジョブ` |
| マスタ依存の設定データ | 参照マスタにぶら下がる設定値。アプリ挙動に必要だが、学期運用ではない | `timetable_presets` | `seed` + `管理ジョブ` |
| 時間依存の運用データ | 学期・年度・運用都合で増減し、将来差し替わる | `terms`, `courses`, `course_offerings`, `offering_slots` の中でも投入データ、`offering_seed` | `管理ジョブ` |

### 2. 配置原則

| 管理場所 | 置くもの | 置かないもの |
| --- | --- | --- |
| `supabase/migrations` | DDL, RLS, RPC, trigger, index, schema 互換維持に必要な一回限りの backfill | 継続運用する master data, 大学一覧, 時間割 preset, 学期ごとの offerings |
| `supabase/seeds` | `db reset` 後に再現したい初期データ。参照マスタと設定データの idempotent seed | 学期依存の offerings 本番データ |
| `supabase/snippets` | Studio / 手動実行用の一時 SQL。検証、障害対応、移行補助 | source of truth |
| 管理ジョブ | remote/local に対して意図的に流す upsert/import。CSV/JSON などの正本から同期する処理 | schema 定義 |

### 3. このプロジェクトでの最終判断

- `universities` は **不変に近い参照マスタ**。`migration` には入れず、`seed` と `管理ジョブ` で管理する。
- `timetable_presets` は **マスタ依存の設定データ**。テーブル定義だけを `migration` に置き、中身は `seed` と `管理ジョブ` で管理する。
- `offering_seed` 相当のデータは **時間依存の運用データ**。`migration` に入れない。原則 `管理ジョブ` で投入し、必要ならローカル確認用の任意 seed を別管理する。

## なぜそうするか

### migration に入れるべきでない理由

- migration は「過去から現在まで schema を再構築する履歴」であり、運用データの最新版を持つ場所ではない。
- 大学一覧や時間割 preset は将来修正・追加・無効化が起こる。これを migration に積むと、履歴が「schema 変更」ではなく「現時点のカタログ更新」で汚染される。
- `offering_seed` のような学期依存データは、2025 後期を過ぎたら古くなる。migration に残すと `db reset` のたびに古い学期データが復元される。
- 本番で migration を流すたびに運用データが暗黙更新される設計は、差分追跡とロールバック判断を難しくする。

### seed に置く理由

- local `supabase db reset` 後に、onboarding や timetable UI が最低限動く状態を再現できる。
- `insert ... on conflict do update` で idempotent にできるため、開発環境で扱いやすい。
- 参照マスタと設定データは「ある程度固定された初期状態」を配る用途に向いている。

### 管理ジョブを使う理由

- remote/staging/prod は `seed` を自動適用しない前提で運用する方が安全。
- `universities` や `timetable_presets` は、CSV/JSON を正本にして同期ジョブで更新した方が、追加・修正・無効化の監査がしやすい。
- `offerings` 系は件数も更新頻度も高く、学期単位で差し替わるため、専用 import job の責務に分離すべき。

### snippet の位置づけ

- snippet は「その場しのぎの実行単位」であり、永続ルールの置き場ではない。
- snippet で成功した SQL を今後も使うなら、必ず `migration` か `seed` か `管理ジョブ` に昇格させる。

## ディレクトリ責務

### `supabase/migrations/`

責務:
- schema 作成・変更
- constraint / index / RLS / RPC / trigger
- 既存 schema を新 schema に整合させる一回限りの backfill

禁止:
- 大学一覧の追加
- preset カタログの同期
- 学期データの投入
- 開発用サンプルデータの常設

許可される例外:
- schema 変更に絶対必要な一回限りのデータ補正
- 例: `new_column` 追加直後に既存行を埋める backfill

### `supabase/seeds/`

責務:
- `supabase db reset` 後の初期状態の再現
- 参照マスタの投入
- 参照マスタに依存する設定データの投入

原則:
- すべて idempotent にする
- 依存順を固定する
- remote 本番の source of truth ではなく、`local reset 用の再現手段` として扱う

推奨構成:

```text
supabase/seeds/
  00_universities.sql
  10_timetable_presets.sql
  dev/
    20_offering_sample.sql
  universities.csv
  timetable_presets_top_universities.csv
```

実装済み:
- `supabase/config.toml` は `00_universities.sql` -> `10_timetable_presets.sql` の順で seed を読む
- `supabase/seeds/dev/20_offering_sample.sql` は default seed には含めない

### `supabase/snippets/`

責務:
- Studio での手動確認
- 一時的な検証 SQL
- 障害対応やデータ修復の実験

ルール:
- snippet は source of truth にしない
- 同じ snippet を 2 回以上使うなら管理ジョブ化を検討する
- 本番実行した snippet は、必要なら後でドキュメント化する

### 管理ジョブ

想定配置:
- `scripts/` または `backend/src/scripts/`

責務:
- CSV/JSON から `universities` を同期
- `universities` 解決後に `timetable_presets` を同期
- 学期ごとの `terms / courses / course_offerings / offering_slots` を import

要件:
- idempotent
- dry-run 可能
- upsert ベース
- remote 実行前提でログを残せる
- `university name -> university_id` 解決失敗を検知できる

実装済み:
- `scripts/generate-universities-seed.sh`
- `scripts/generate-timetable-preset-seed.sh`
- `scripts/rebuild-supabase-seeds.sh`
- `scripts/apply-supabase-master-data.sh`
- `scripts/apply-supabase-dev-offering-sample.sh`
- `backend/src/scripts/importSenshuOfferings.ts`
- `backend/src/scripts/mapOfferingImport.ts`
- `backend/src/scripts/unmapOfferingImport.ts`

## 個別判断

### `universities`

分類:
- 不変に近い参照マスタ

管理場所:
- テーブル定義: `migration`
- データ本体: `seed` + `管理ジョブ`
- snippet: 一時補助のみ

理由:
- onboarding, profile, timetable preset, 将来の course import の起点になる基礎マスタだから
- 一方で schema 自体ではなく、追加・名称補正・統廃合の可能性があるため migration に埋め込まない方がよい

運用ルール:
- `name` だけでなく、将来的には外部連携用の安定キー追加を検討する
- まずは `name unique` を維持しつつ、seed/job は exact match 前提で同期する
- onboarding が依存するため、`universities` は local reset 後に必ず入る状態を保証する

### `timetable_presets`

分類:
- マスタ依存の設定データ

管理場所:
- テーブル定義と validation 関数: `migration`
- preset データ本体: `seed` + `管理ジョブ`
- 正本: CSV などの編集しやすいデータファイル

理由:
- `universities` に依存する設定データであり、schema ではない
- 期間依存ではないが、将来修正される可能性は高い
- CSV 正本 -> SQL 生成 -> seed/job 適用の流れにすると、人手修正より事故が少ない

運用ルール:
- `global default` も preset データとして扱い、migration に混ぜない
- university 未解決時に暗黙で `universities` を作らない
- `timetable_presets` の同期は `universities` 同期後に実行する
- `timetable_presets` を remote に適用した直後は `select public.sync_profile_timetable_settings_to_presets();` を実行し、`preset_id` 付きユーザー設定を最新 preset に再同期する

### `offering_seed`

分類:
- 時間依存の運用データ

管理場所:
- 本番相当データ: `管理ジョブ`
- ローカル確認用の小さなサンプル: 必要なら `supabase/seeds/dev/*` に任意配置
- snippet: 単発検証のみ
- migration: 不可

理由:
- `terms / course_offerings / offering_slots` は学期と運用に強く依存する
- 2025 後期の seed を migration に埋めると、将来の reset で古い現実を再生してしまう
- シラバス import や学期差し替えは、履歴管理よりも同期処理の問題として扱うべき

運用ルール:
- 学期単位で import job を分ける
- `course_offerings` は upsert キーを明確化する
- upstream external id は `source_mappings` に保持し、canonical table 側に単一の external id を埋め込まない
- default の `db reset` seed に本番相当 offerings を含めない
- UI 検証用サンプルが必要なら、`dev-only` seed として分離し、明示実行にする

## このプロジェクトの固定ルール

今後は以下を固定ルールとする。

1. migration に seed 的 SQL を入れない。
2. `universities` は参照マスタとして `seed` と `管理ジョブ` で同期する。
3. `timetable_presets` は `universities` 依存の設定データとして `seed` と `管理ジョブ` で同期する。
4. `terms / courses / course_offerings / offering_slots` の投入データは、schema ではなく運用データとして扱う。
5. Storage bucket の provisioning は migration ではなく、local は `supabase/config.toml`、remote は provisioning script で管理する。
5. `offering_seed` のような学期依存データは migration に入れない。
6. snippet は source of truth にしない。
7. remote 環境の master/config 更新は、手動 SQL ではなく原則として管理ジョブ経由で行う。
8. `db reset` で必要なのは「アプリが起動する最低限の参照マスタと設定データ」までに留める。
9. 本番運用データの投入と schema 変更を同じ PR / 同じ migration に混ぜない。

## Pre-release Cleanup Rule

個人開発かつリリース前の段階では、active migration chain を定期的に掃除してよい。  
ただし、やってよいのは **fix-only migration を先行する feature migration に吸収する rebaseline** までに限る。

条件:
- 共有環境の正式リリース前である
- どの migration をどこへ吸収したかを repo 内に記録する
- 既存 DB は、編集後の migration chain と整合するように reset / rebaseline する前提で扱う

禁止:
- 共有済み production 相当環境に対して、履歴だけを勝手に書き換えること
- schema と seed 的データ移行をまとめて曖昧に潰すこと
- 何を消したか分からないまま migration を削除すること

推奨単位:
- 1つの機能追加 migration
- その機能に対する直後の fix migration 数本
- 吸収後も responsibility が読める粒度を保つ

## 現状からの移行プラン

### Phase 1: ルール固定

- 本ドキュメントを正本として採用する
- `AGENTS.md` から参照できるようにする

### Phase 2: migration からデータ投入を剥がす

対象:
- `supabase/migrations/20260217125838_offering_seed.sql`
- `supabase/migrations/20260304104000_seed_timetable_presets_top_universities.sql`

対応:
- `offering_seed.sql` は廃止し、必要なら `dev-only` seed か import job に移す
- `seed_timetable_presets_top_universities.sql` は `supabase/seeds/10_timetable_presets.sql` に移す
- `universities` upsert を含む SQL は `supabase/seeds/00_universities.sql` に分離する

注意:
- 既存 migration は履歴なので、ファイル自体を削除して過去を壊さない
- 既存ファイルは no-op にし、今後は新規 migration にデータ seed を入れない
- remote 既存環境との差分は、別途管理ジョブで吸収する

### Phase 3: seed の正本を整理する

- `supabase/seeds/universities.csv` を追加する
- 既存 `supabase/seeds/timetable_presets_top_universities.csv` を正本として維持する
- CSV から SQL を生成するスクリプトを `scripts/` に置き、生成先を `supabase/seeds/*.sql` に統一する
- `supabase/config.toml` の `db.seed.sql_paths` を、実在する seed ファイル列に更新する

### Phase 4: 管理ジョブ化する

最低限必要なジョブ:
- `sync-universities`
- `sync-timetable-presets`
- `import-offerings --university <...> --year <...> --season <...>`

要件:
- remote/local を切り替え可能
- dry-run あり
- upsert 結果を件数で表示
- 失敗時にどの大学名・どの offering が不整合か分かる

## 補足

- migration にデータが混ざっている現状は、初期立ち上げではよくあるが、大学マスタと学期運用データを同じ方式で扱い続けると必ず破綻する。
- `studyshare` では onboarding と timetable が `universities` / `timetable_presets` に依存しているため、この 2 つだけは「local reset で必ず再現できる seed」に寄せるべき。
- 一方で offerings 系は運用データであり、seed ではなく import/sync の問題として切り分けるのが正しい。

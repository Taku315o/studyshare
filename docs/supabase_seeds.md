# Supabase Seeds Guide

最終更新: 2026-03-13

このドキュメントは、`studyshare` における seed の扱い、投入方法、関連 scripts の使い方をまとめた運用ガイドです。  
対象は主に `supabase/seeds/` と `scripts/` 配下の seed 関連ファイルです。

## 結論

- `migration` は schema を作る履歴
- `seed` は `db reset` 後に最低限の初期データを再現するもの
- remote/staging/prod への master data 更新は、原則 `seed SQL + apply script` で明示実行する
- 学期依存の offerings 系データは default seed に入れない

## どのデータを seed に置くか

このプロジェクトでは seed 対象を以下に限定する。

| 種別 | 例 | default seed に含めるか |
| --- | --- | --- |
| 参照マスタ | `universities` | 含める |
| マスタ依存設定 | `timetable_presets` | 含める |
| 学期依存の運用データ | `terms`, `courses`, `course_offerings`, `offering_slots` の本番相当データ | 含めない |
| UI 検証用サンプル | 開発用 offering sample | 含めない。必要時のみ明示適用 |

## 現在の seed 構成

```text
supabase/seeds/
  00_universities.sql
  10_timetable_presets.sql
  dev/
    20_offering_sample.sql
  universities.csv
  timetable_presets_top_universities.csv
```

役割:

- `supabase/seeds/universities.csv`
  - `universities` の正本 CSV
- `supabase/seeds/00_universities.sql`
  - CSV から生成された idempotent seed SQL
- `supabase/seeds/timetable_presets_top_universities.csv`
  - 大学別時間割 preset の正本 CSV
- `supabase/seeds/10_timetable_presets.sql`
  - CSV から生成された idempotent seed SQL
- `supabase/seeds/dev/20_offering_sample.sql`
  - 開発時のみ任意適用する sample data

## `supabase db reset` との関係

`supabase/config.toml` では default seed が有効になっている。

現在の設定:

```toml
[db.seed]
enabled = true
sql_paths = ["./seeds/00_universities.sql", "./seeds/10_timetable_presets.sql"]
```

つまり `supabase db reset` を実行すると、

1. migration が流れる
2. `00_universities.sql` が流れる
3. `10_timetable_presets.sql` が流れる

という順で DB が再構築される。

`supabase/seeds/dev/20_offering_sample.sql` はここには含まれない。  
必要なときだけ手動で適用する。

## seed の source of truth

この repo では、seed の正本は SQL ではなく一部 CSV に置いている。

- `universities` の正本: `supabase/seeds/universities.csv`
- `timetable_presets` の正本: `supabase/seeds/timetable_presets_top_universities.csv`

運用上の原則:

- 直接 `00_universities.sql` や `10_timetable_presets.sql` を手で編集しない
- まず CSV を編集する
- その後 generator script で SQL を再生成する
- 生成後に差分を確認して commit する

## 関連 scripts

### `scripts/generate-universities-seed.sh`

用途:

- `universities.csv` から `00_universities.sql` を生成する

使い方:

```bash
./scripts/generate-universities-seed.sh supabase/seeds/universities.csv
./scripts/generate-universities-seed.sh supabase/seeds/universities.csv supabase/seeds/00_universities.sql
```

仕様:

- CSV 1 列目を大学名として扱う
- ヘッダー行は読み飛ばす
- 重複大学名は 1 件にまとめる
- `insert ... on conflict (name) do update` 形式で SQL を生成する

### `scripts/generate-timetable-preset-seed.sh`

用途:

- `timetable_presets_top_universities.csv` から `10_timetable_presets.sql` を生成する

使い方:

```bash
./scripts/generate-timetable-preset-seed.sh supabase/seeds/timetable_presets_top_universities.csv
./scripts/generate-timetable-preset-seed.sh supabase/seeds/timetable_presets_top_universities.csv supabase/seeds/10_timetable_presets.sql
```

仕様:

- CSV の大学名ごとに periods JSON を組み立てる
- `name = 'default'` の global preset を先に upsert する
- 続いて各大学の `default` preset を upsert する
- 大学名が `public.universities.name` と一致しない場合は warning を出してスキップする

### `scripts/rebuild-supabase-seeds.sh`

用途:

- seed SQL をまとめて再生成する

使い方:

```bash
./scripts/rebuild-supabase-seeds.sh
```

実行内容:

- `supabase/seeds/universities.csv` -> `supabase/seeds/00_universities.sql`
- `supabase/seeds/timetable_presets_top_universities.csv` -> `supabase/seeds/10_timetable_presets.sql`

CSV を編集したあとに最初に使うべき script はこれ。

### `scripts/apply-supabase-master-data.sh`

用途:

- `00_universities.sql` と `10_timetable_presets.sql` を、指定した Postgres に適用する

使い方:

```bash
DATABASE_URL='postgresql://...' ./scripts/apply-supabase-master-data.sh
./scripts/apply-supabase-master-data.sh 'postgresql://...'
./scripts/apply-supabase-master-data.sh --dry-run 'postgresql://...'
```

仕様:

- `psql` が必要
- `--dry-run` では実行せず、対象ファイルだけ表示する
- 適用順は `00_universities.sql` -> `10_timetable_presets.sql`
- seed 適用後に `select public.sync_profile_timetable_settings_to_presets();` を実行し、`preset_id` 付きユーザー設定を最新 preset に再同期する

想定用途:

- remote/staging/prod に master data を同期する
- local DB に対して `db reset` を使わず master data だけを再適用する

### `scripts/apply-supabase-dev-offering-sample.sh`

用途:

- `supabase/seeds/dev/20_offering_sample.sql` を明示的に適用する

使い方:

```bash
DATABASE_URL='postgresql://...' ./scripts/apply-supabase-dev-offering-sample.sh
./scripts/apply-supabase-dev-offering-sample.sh 'postgresql://...'
./scripts/apply-supabase-dev-offering-sample.sh --dry-run 'postgresql://...'
```

仕様:

- `psql` が必要
- default seed には含まれない
- ローカル UI 検証用としてのみ使う

## 推奨ワークフロー

### 1. CSV を更新したとき

例:

- 大学一覧を追加した
- 時間割 preset を修正した

手順:

1. `supabase/seeds/*.csv` を編集する
2. `./scripts/rebuild-supabase-seeds.sh` を実行する
3. 生成された `.sql` の diff を確認する
4. local を作り直すなら `supabase db reset`
5. remote に反映するなら `./scripts/apply-supabase-master-data.sh`

### 2. ローカル DB を作り直したいとき

手順:

1. active migration chain を確認する
2. `supabase db reset` を実行する
3. 必要なら `supabase/seeds/dev/20_offering_sample.sql` を追加適用する

例:

```bash
supabase db reset
DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:54322/postgres' \
  ./scripts/apply-supabase-dev-offering-sample.sh
```

### 3. remote に master data だけ反映したいとき

手順:

1. CSV を編集する
2. `./scripts/rebuild-supabase-seeds.sh`
3. `./scripts/apply-supabase-master-data.sh --dry-run <DATABASE_URL>`
4. 内容がよければ本実行する

例:

```bash
./scripts/rebuild-supabase-seeds.sh
./scripts/apply-supabase-master-data.sh --dry-run 'postgresql://...'
./scripts/apply-supabase-master-data.sh 'postgresql://...'
```

## やってはいけないこと

- master data を migration に戻さない
- `00_universities.sql` と `10_timetable_presets.sql` を手で直接編集し続けない
- 学期依存の offering data を default seed に入れない
- remote に対して `db reset` 相当の破壊操作を軽く実行しない
- snippet をそのまま source of truth にしない

## トラブルシュート

### `db reset` 後に onboarding で大学一覧が出ない

確認点:

- `supabase/config.toml` の `[db.seed]` が有効か
- `supabase/seeds/00_universities.sql` が存在するか
- CSV 更新後に `./scripts/rebuild-supabase-seeds.sh` を実行したか

### timetable preset が反映されない

確認点:

- `supabase/seeds/10_timetable_presets.sql` が最新か
- 対象大学名が `public.universities.name` と完全一致しているか
- generator 実行時に warning が出ていないか

### remote 反映時に失敗する

確認点:

- `DATABASE_URL` が正しいか
- `psql` が PATH にあるか
- 先に `universities` が入る順序になっているか

## 関連ドキュメント

- `docs/supabase_operations.md`
- `docs/db_schema.md`
- `AGENTS.md`

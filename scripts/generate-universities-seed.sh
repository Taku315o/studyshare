#!/usr/bin/env bash
set -euo pipefail
#渡された引数の数が1未満または2より多い場合、使用方法を表示して終了する。
if [[ $# -lt 1 || $# -gt 2 ]]; then
  echo "Usage: $0 <input_csv> [output_sql]" >&2
  exit 1
fi
# 入力CSVから大学名を抽出し、SQLのINSERT文を生成するスクリプト。
INPUT_CSV="$1"
OUTPUT_SQL="${2:-}"

if [[ ! -f "$INPUT_CSV" ]]; then
  echo "Input CSV not found: $INPUT_CSV" >&2
  exit 1
fi

generate_sql() {
  awk -F',' '
    function escape_sql(s,   t) {
      t = s
      gsub(/\047/, "\047\047", t)
      return t
    }

    NR == 1 { next }
    NF < 1 { next }

    {
      name = $1
      if (name == "") {
        next
      }

      if (!(name in seen)) {
        seen[name] = 1
        order[++count] = name
      }
    }

    END {
      split(FILENAME, parts, "/")
      print "-- generated from supabase/seeds/" parts[length(parts)]
      print "-- source of truth: universities.csv\n"
      print "insert into public.universities (name)"
      print "select source.name"
      print "from ("
      print "  values"

      for (i = 1; i <= count; i++) {
        suffix = (i < count) ? "," : ""
        printf "    ('\''%s'\'')%s\n", escape_sql(order[i]), suffix
      }

      print ") as source(name)"
      print "on conflict (name) do update"
      print "set name = excluded.name;"
    }
  ' "$INPUT_CSV"
}

if [[ -n "$OUTPUT_SQL" ]]; then
  generate_sql > "$OUTPUT_SQL"
  echo "Generated: $OUTPUT_SQL"
else
  generate_sql
fi

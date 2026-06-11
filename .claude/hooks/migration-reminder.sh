#!/bin/sh
# PostToolUse(Write|Edit): when a DB migration or schema file changes, inject the
# RLS/tenancy checklist as additional context so it can't be skipped.

path=$(node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{try{process.stdout.write(JSON.parse(d).tool_input?.file_path??"")}catch{}})')

case "$path" in
  *packages/db/migrations/*|*packages/db/src/schema.ts)
    cat <<'EOF'
{"hookSpecificOutput":{"hookEventName":"PostToolUse","additionalContext":"DB schema change detected — the vantera-db-migrations checklist applies (rule 02): every new table needs account_id tenancy + ENABLE ROW LEVEL SECURITY in the SAME migration, policies via is_account_member/is_account_admin, security definer functions with search_path='', the table added to the RLS guardrail test in schema.test.ts, and a retention note for prospect-data tables (rule 11). Applied migrations are immutable — never edit an existing migration file. Run the rls-auditor subagent before committing."}}
EOF
    ;;
esac

exit 0
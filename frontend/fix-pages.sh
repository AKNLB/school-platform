#!/usr/bin/env bash
set -e

make_page () {
  local path="$1"
  local title="$2"

  rm -f "$path"
  mkdir -p "$(dirname "$path")"

  cat > "$path" <<EOF
"use client";

export default function ${title//[^a-zA-Z0-9]/}Page() {
  return (
    <main style={{ padding: 24 }}>
      <h1 style={{ margin: 0 }}>${title}</h1>
      <p style={{ marginTop: 8, opacity: 0.8 }}>
        Placeholder page (UI only). Next step: connect to <code>/api</code>.
      </p>
    </main>
  );
}

export {};
EOF
}

make_page "src/app/dashboard/events/page.tsx" "Events"
make_page "src/app/dashboard/students/page.tsx" "Students"
make_page "src/app/dashboard/attendance/page.tsx" "Attendance"
make_page "src/app/dashboard/scores/page.tsx" "Scores"
make_page "src/app/dashboard/report-cards/page.tsx" "ReportCards"
make_page "src/app/dashboard/tasks/page.tsx" "Tasks"
make_page "src/app/dashboard/resources/page.tsx" "Resources"
make_page "src/app/dashboard/finance/page.tsx" "Finance"
make_page "src/app/dashboard/settings/page.tsx" "Settings"

echo "✅ Done. Placeholder pages rewritten."

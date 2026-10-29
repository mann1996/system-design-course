#!/bin/bash
set -e

CONFIG_FILE="$HOME/.gemini/config/sidecars/daily-lesson-generator/sidecar.json"

echo "==> Updating Daily Curriculum Lesson Generator automation config..."
cat << 'EOF' > "$CONFIG_FILE"
{
  "builtin": "schedule",
  "args": [
    "CRON_TZ=Asia/Kolkata 0 8 * * *",
    "agentapi",
    "new-conversation",
    "--",
    "Follow the /teach skill (.agents/skills/teach/SKILL.md) and workspace standards (AGENTS.md, MISSION.md, NOTES.md, RESOURCES.md) in /Users/jaspreetsingh/Projects/Teach Me/System Design to create 2 new lessons in the React PWA:\n1. Read curriculum.json to inspect current lessons and determine the next 2 logical distributed system design lessons in the curriculum sequence.\n2. For each lesson:\n   - Author the React PWA component in src/pages/lessons/LessonXXXX.tsx following the design system and using standard UI components (BadgeRow, LessonHeaderStatus, PrimarySourceCallout, CodeWindowCard with TypeScript/Node snippets, AIPitfallCallout, active-retrieval Quiz with balanced options, LessonNavButtons, and AgentReminder).\n   - Register the lesson in src/pages/LessonDispatcher.tsx (update resolveCanonicalLessonId and route render check).\n   - Add the lesson metadata (id, filename, title, navTitle, badge, time, tag, summary) into curriculum.json under the appropriate module.\n3. Run npm run build (tsc && vite build) to verify 0 TypeScript compiler errors and ensure the PWA production bundle builds cleanly.\n4. Run python3 scripts/sync_curriculum.py to keep curriculum references synchronized.\n5. Commit and push the changes to GitHub:\n   - Run git add to stage the new lessons, simulators, updated curriculum.json, LessonDispatcher.tsx, and learning records.\n   - Run git commit -m \"feat: add Lesson XXXX and Lesson YYYY with interactive simulators\" (replacing with actual lesson IDs).\n   - Run git push origin main to publish changes.\n6. Summarize the 2 newly authored lessons and confirmation of clean build and successful GitHub push."
  ],
  "restart_policy": "always",
  "display_name": "Daily Curriculum Lesson Generator",
  "description": "Every day at 8:00 AM (Asia/Kolkata), creates 2 new system design lessons in the React PWA using the /teach skill, verifies the build, synchronizes curriculum references, and commits & pushes changes to GitHub.",
  "agent_permissions": {
    "workspace_uris": [
      "file:///Users/jaspreetsingh/Projects/Teach Me/System Design"
    ],
    "access_grants": [
      "command(npm run build)",
      "command(python3 scripts/sync_curriculum.py)",
      "command(git status)",
      "command(git add)",
      "command(git commit)",
      "command(git push)"
    ]
  }
}
EOF

echo "✓ Automation config updated at $CONFIG_FILE"

echo "==> Pushing local commit to GitHub (origin/main)..."
git push origin main
echo "✓ Successfully pushed to GitHub!"

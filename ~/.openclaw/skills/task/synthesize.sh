#!/bin/bash
# synthesize.sh - 汇总所有子任务结果
# 用法: ./synthesize.sh [plan_file]

TASK_DIR="$HOME/.openclaw/tasks"
PLAN_FILE="${1:-$TASK_DIR/current.json}"

if [ ! -f "$PLAN_FILE" ]; then
  echo "错误: 找不到计划文件 $PLAN_FILE"
  exit 1
fi

GOAL=$(cat "$PLAN_FILE" | jq -r '.goal')

# 收集所有结果
RESULTS=""
for RESULT_FILE in "$TASK_DIR/results"/*.txt; do
  if [ -f "$RESULT_FILE" ]; then
    TASK_ID=$(basename "$RESULT_FILE" .txt)
    RESULTS="$RESULTS

=== $TASK_ID ===
$(cat "$RESULT_FILE")
"
  fi
done

SYNTH_PROMPT="You are synthesizing results from multiple subtasks.

Original Goal: $GOAL

Subtask Results:
$RESULTS

Provide a coherent summary that:
1. Answers the original goal
2. Integrates findings from all subtasks
3. Highlights key decisions/recommendations
4. Notes any issues or concerns

Be concise but complete. Use the same language as the goal."

claude -p "$SYNTH_PROMPT"

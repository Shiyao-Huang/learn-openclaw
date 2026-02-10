#!/bin/bash
# plan.sh - 将复杂任务拆解为子任务
# 用法: ./plan.sh "任务描述"

TASK_DIR="$HOME/.openclaw/tasks"
mkdir -p "$TASK_DIR/results" "$TASK_DIR/history"

GOAL="$1"

if [ -z "$GOAL" ]; then
  echo "用法: ./plan.sh \"任务描述\""
  exit 1
fi

PLANNER_PROMPT='You are a task planner. Break down the goal into subtasks.

Output JSON only, no explanation:
{
  "goal": "original goal",
  "tasks": [
    {
      "id": "T1",
      "type": "explore|research|code|review|general",
      "prompt": "specific task description",
      "depends_on": [],
      "background": false
    }
  ]
}

Rules:
- Use explore/research for information gathering (read-only)
- Use code for implementation
- Use review for quality checks
- Set depends_on for tasks that need prior results
- Mark independent tasks for parallel execution
- Keep tasks atomic and specific
- 3-7 tasks is usually right'

RESULT=$(claude -p --output-format json "$PLANNER_PROMPT

Goal: $GOAL")

echo "$RESULT" > "$TASK_DIR/current.json"
echo "计划已保存到 $TASK_DIR/current.json"
echo ""
cat "$TASK_DIR/current.json" | jq -r '.tasks[] | "[\(.id)] [\(.type)] \(.prompt) \(if .depends_on | length > 0 then "(依赖: " + (.depends_on | join(", ")) + ")" else "" end)"' 2>/dev/null || cat "$TASK_DIR/current.json"

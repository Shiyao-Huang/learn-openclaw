#!/bin/bash
# exec.sh - 执行单个任务
# 用法: ./exec.sh <task_id> [--plan <plan_file>]

TASK_DIR="$HOME/.openclaw/tasks"
SKILL_DIR="$(dirname "$0")"
TASK_ID="$1"
PLAN_FILE="${3:-$TASK_DIR/current.json}"

if [ -z "$TASK_ID" ]; then
  echo "用法: ./exec.sh <task_id>"
  exit 1
fi

if [ ! -f "$PLAN_FILE" ]; then
  echo "错误: 找不到计划文件 $PLAN_FILE"
  exit 1
fi

# 提取任务信息
TASK=$(cat "$PLAN_FILE" | jq -r ".tasks[] | select(.id == \"$TASK_ID\")")

if [ -z "$TASK" ] || [ "$TASK" = "null" ]; then
  echo "错误: 找不到任务 $TASK_ID"
  exit 1
fi

TYPE=$(echo "$TASK" | jq -r '.type')
PROMPT=$(echo "$TASK" | jq -r '.prompt')
DEPENDS=$(echo "$TASK" | jq -r '.depends_on[]?' 2>/dev/null)

# 收集依赖任务的结果
CONTEXT=""
for DEP in $DEPENDS; do
  DEP_RESULT="$TASK_DIR/results/${DEP}.txt"
  if [ -f "$DEP_RESULT" ]; then
    CONTEXT="$CONTEXT

=== Result from $DEP ===
$(cat "$DEP_RESULT")
"
  fi
done

# 映射 type 到 agent
case "$TYPE" in
  explore) AGENT="researcher" ;;
  research) AGENT="researcher" ;;
  code) AGENT="coder" ;;
  review) AGENT="reviewer" ;;
  *) AGENT="researcher" ;;
esac

# 构建完整 prompt
FULL_PROMPT="$PROMPT"
if [ -n "$CONTEXT" ]; then
  FULL_PROMPT="Context from previous tasks:
$CONTEXT

Your task: $PROMPT"
fi

echo "[$TASK_ID] 执行中... (agent: $AGENT)"
echo "Prompt: $PROMPT"
echo "---"

# 执行
RESULT=$("$SKILL_DIR/../subagent/spawn.sh" "$AGENT" "$FULL_PROMPT")

# 保存结果
echo "$RESULT" > "$TASK_DIR/results/${TASK_ID}.txt"

# 更新状态
TMP=$(mktemp)
cat "$PLAN_FILE" | jq "(.tasks[] | select(.id == \"$TASK_ID\")).status = \"done\"" > "$TMP"
mv "$TMP" "$PLAN_FILE"

echo "$RESULT"
echo "---"
echo "[$TASK_ID] 完成，结果已保存"

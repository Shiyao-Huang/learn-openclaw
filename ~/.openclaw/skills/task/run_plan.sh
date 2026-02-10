#!/bin/bash
# run_plan.sh - 执行整个任务计划
# 用法: ./run_plan.sh [plan_file]

TASK_DIR="$HOME/.openclaw/tasks"
SKILL_DIR="$(dirname "$0")"
PLAN_FILE="${1:-$TASK_DIR/current.json}"

if [ ! -f "$PLAN_FILE" ]; then
  echo "错误: 找不到计划文件 $PLAN_FILE"
  exit 1
fi

echo "=== 执行计划 ==="
cat "$PLAN_FILE" | jq -r '.goal' 2>/dev/null
echo ""

# 获取所有任务
TASKS=$(cat "$PLAN_FILE" | jq -r '.tasks[].id')

# 简单的拓扑排序执行（依赖优先）
DONE=""

while true; do
  PROGRESS=false
  
  for TASK_ID in $TASKS; do
    # 跳过已完成的
    if echo "$DONE" | grep -q "$TASK_ID"; then
      continue
    fi
    
    # 检查依赖是否都完成
    DEPS=$(cat "$PLAN_FILE" | jq -r ".tasks[] | select(.id == \"$TASK_ID\") | .depends_on[]?" 2>/dev/null)
    ALL_DEPS_DONE=true
    
    for DEP in $DEPS; do
      if ! echo "$DONE" | grep -q "$DEP"; then
        ALL_DEPS_DONE=false
        break
      fi
    done
    
    if [ "$ALL_DEPS_DONE" = true ]; then
      echo ""
      echo "=========================================="
      "$SKILL_DIR/exec.sh" "$TASK_ID" --plan "$PLAN_FILE"
      DONE="$DONE $TASK_ID"
      PROGRESS=true
    fi
  done
  
  # 如果没有进展，说明完成了或有循环依赖
  if [ "$PROGRESS" = false ]; then
    break
  fi
done

echo ""
echo "=== 计划执行完成 ==="
echo "结果保存在: $TASK_DIR/results/"

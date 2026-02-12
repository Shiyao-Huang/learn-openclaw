#!/bin/bash
# Test script for v12-v19 agents
# Usage: ./test-versions.sh [v12|v13|v13.5|v14|v15|v16|v17|v18|v19]

VERSION=$1
BASE_DIR="/Users/swmt/work/deepwork/learn-openclaw"

if [ -z "$VERSION" ]; then
  echo "Usage: $0 [v12|v13|v13.5|v14|v15|v16|v17|v18|v19]"
  exit 1
fi

FILE="$BASE_DIR/${VERSION}-agent.ts"
if [ ! -f "$FILE" ]; then
  echo "ERROR: File not found: $FILE"
  exit 1
fi

echo "=========================================="
echo "Testing $VERSION"
echo "File: $FILE"
echo "=========================================="

# Run with bun
cd "$BASE_DIR"
bun run "$FILE" <<EOF
hello
exit
EOF

echo ""
echo "=========================================="
echo "$VERSION test completed"
echo "=========================================="

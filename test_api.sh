#!/bin/bash
curl -s -X POST http://175.178.49.176:3000/api/v1/messages \
  -H "Content-Type: application/json" \
  -H "x-api-key: cr_144da213fa6be701965e02af982c5d8c4e5e28e6ff084da6604de6aa26ab29e1" \
  -d '{"model":"claude-opus-4-6","max_tokens":100,"messages":[{"role":"user","content":"hello"}]}'

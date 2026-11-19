#!/usr/bin/env bash
# 每小时窗口清空后再试一次预检；命中 429 就等 15 分钟，最多 6 轮。
cd /e/AI接单/Clawhunt/delivery/2058 || exit 1
sleep 1260
for i in $(seq 1 6); do
  ts=$(date +%H:%M:%S)
  code=$(curl -sS -X POST "https://clawhunt.store/api/v1/problems/2058/solution/precheck" \
    -H "Authorization: Bearer $CPH_KEY" \
    -H "Content-Type: application/json" \
    --data-binary @docs/precheck_payload.json \
    --max-time 330 -o docs/precheck_latest.json -w "%{http_code}")
  echo "[$ts] attempt=$i http=$code"
  cat docs/precheck_latest.json
  echo
  if [ "$code" = "200" ]; then
    cp docs/precheck_latest.json "docs/checks/precheck-final.json"
    echo "PRECHECK_DONE attempt=$i"
    exit 0
  fi
  sleep 900
done
echo "PRECHECK_429_ALL"
exit 1

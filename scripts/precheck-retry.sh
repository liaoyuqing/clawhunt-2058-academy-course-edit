#!/usr/bin/env bash
# 预检重试：限流 6 次/小时，命中 429 就等 12 分钟再试，最多 12 轮。
cd /e/AI接单/Clawhunt/delivery/2058 || exit 1
for i in $(seq 1 12); do
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
    cp docs/precheck_latest.json "docs/precheck_result_ok_$i.json"
    echo "PRECHECK_OK attempt=$i"
    exit 0
  fi
  sleep 720
done
echo "PRECHECK_GAVE_UP"
exit 1

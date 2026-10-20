#!/usr/bin/env bash
# Q7 idle poll: EndpointActiveEnvironments (Maximum) every 5 min for up to 60 min.
# No datapoints in the window means 0 active environments (verified in README, 0.3.8).
# macOS/BSD date only (uses date -v and date -r).
# Run by the user (calls CloudWatch). Required env: FUNCTION_NAME, ENDPOINT_NAME. Optional: AWS_REGION (default us-east-1).
set -euo pipefail

command -v aws >/dev/null 2>&1 || { echo "ERROR: aws CLI not found in PATH" >&2; exit 1; }
: "${FUNCTION_NAME:?set FUNCTION_NAME}"
: "${ENDPOINT_NAME:?set ENDPOINT_NAME}"
REGION="${AWS_REGION:-us-east-1}"
NS="AWS/Lambda/Web/Usage"
DIMS="Name=FunctionName,Value=${FUNCTION_NAME} Name=EndpointName,Value=${ENDPOINT_NAME} Name=ExecutionRegion,Value=${REGION}"
T0="$(date -u +%s)"
echo "T0 (UTC): $(date -u -r "$T0" +%FT%TZ). Last request must be at or before T0."

# $1 = metric, $2 = statistic. Prints "<max value or None>|<last datapoint timestamp or None>".
# aws failure (credentials, throttling, bad args) is NOT swallowed: it exits the script with ERROR.
stat() {
  local out
  # shellcheck disable=SC2086
  out="$(aws cloudwatch get-metric-statistics --region "$REGION" --namespace "$NS" --metric-name "$1" \
    --dimensions $DIMS --start-time "$(date -u -v-2M +%FT%TZ)" --end-time "$(date -u +%FT%TZ)" \
    --period 60 --statistics "$2" \
    --query "[max(Datapoints[].$2), max_by(Datapoints, &Timestamp).Timestamp]" --output text 2>/dev/null)" \
    || { echo "ERROR: aws cloudwatch call failed for $1 (check credentials/permissions)" >&2; exit 1; }
  echo "${out}" | awk '{print $1 "|" $2}'
}

for i in $(seq 0 12); do
  a="$(stat EndpointActiveEnvironments Maximum)"
  t="$(stat EndpointRequestThrottles Sum)"
  active="${a%%|*}"
  last="${a##*|}"
  case "$active" in None|"") active="0 (no datapoints)"; last="none";; esac
  echo "t+$(( ($(date -u +%s) - T0) / 60 ))min active_environments_max=${active} last_datapoint=${last} throttles_sum=${t%%|*}"
  [ "$i" -lt 12 ] && sleep 300
done
echo "PASS if active_environments_max reached 0 / no-datapoints within 30 min of T0."

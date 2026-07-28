#!/usr/bin/env bash
# Keep SIH scrape→Supabase running overnight; restart on crash; Internações first.
set -u
DATASUS="$(cd "$(dirname "$0")/.." && pwd)"
REPO="$(cd "$DATASUS/.." && pwd)"
OUT="$DATASUS/outputs/coleta_sih_multi"
LOG="$OUT/overnight_watchdog.log"
SCRIPT="$DATASUS/scripts/scrape_upload_sih.py"
MARKER="$OUT/.phase_done"
cd "$REPO" || exit 1
mkdir -p "$OUT"

log() { echo "$(date '+%Y-%m-%d %H:%M:%S') $*" | tee -a "$LOG"; }

run_phase() {
  local name="$1"
  shift
  local stamp_file="$MARKER.$name"
  if [[ -f "$stamp_file" ]]; then
    log "SKIP phase $name (already stamped)"
    return 0
  fi
  while true; do
    log "LAUNCH phase=$name args=$*"
    # shellcheck disable=SC2068
    PYTHONUNBUFFERED=1 python3 "$SCRIPT" $@ >>"$OUT/overnight_scrape_upload.log" 2>&1
    code=$?
    log "EXIT phase=$name code=$code"
    if [[ $code -eq 0 ]] && grep -q "ALL DONE" <(tail -n 5 "$OUT/overnight_scrape_upload.log"); then
      date >"$stamp_file"
      log "PHASE COMPLETE $name"
      return 0
    fi
    log "RESTART phase=$name in 25s"
    sleep 25
  done
}

run_phase internacoes --measure Internações
run_phase measures --measure Óbitos --measure Valor_total --measure Dias_permanência
log "WATCHDOG FINISHED"

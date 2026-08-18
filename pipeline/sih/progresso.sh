#!/bin/bash
# Acompanhamento ao vivo da coleta SIH. Ctrl+C para sair.
CACHE="$HOME/.lacir/sih-cache"
LOG="$(cd "$(dirname "$0")" && pwd)/reports/collect.log"
while true; do
  OUT=$(python3 - "$CACHE" <<'PY'
import json, os, sys, collections
cache = sys.argv[1]
try:
    ufs = json.load(open(os.path.join(cache, 'agregados', 'collect_state.json')))['ufs']
except Exception:
    ufs = {}
ordem = "DF RR AP SE AC AL TO RO RN PB PI AM ES MS MT PE RJ CE PA GO MA SC PR RS BA MG SP".split()
ok   = [u for u in ordem if ufs.get(u, {}).get('status') == 'agregado_reciclado']
bad  = [u for u in ordem if ufs.get(u, {}).get('status') == 'falhou']
todo = [u for u in ordem if u not in ok and u not in bad]
pct  = len(ok) * 100 // 27
barra = '█' * (pct // 5) + '░' * (20 - pct // 5)
print(f"BARRA|{barra}|{len(ok)}|{pct}")
print("OK|" + ' '.join(ok))
print("BAD|" + ' '.join(bad))
print("TODO|" + ' '.join(todo))
linhas = sum(v.get('linhas', 0) for v in ufs.values() if v.get('status') == 'agregado_reciclado')
print(f"LINHAS|{linhas:,}".replace(',', '.'))
PY
)
  BARRA=$(echo "$OUT" | grep '^BARRA|' | cut -d'|' -f2)
  NOK=$(echo "$OUT"   | grep '^BARRA|' | cut -d'|' -f3)
  PCT=$(echo "$OUT"   | grep '^BARRA|' | cut -d'|' -f4)
  OKS=$(echo "$OUT"   | grep '^OK|'    | cut -d'|' -f2)
  BADS=$(echo "$OUT"  | grep '^BAD|'   | cut -d'|' -f2)
  TODOS=$(echo "$OUT" | grep '^TODO|'  | cut -d'|' -f2)
  LINHAS=$(echo "$OUT"| grep '^LINHAS|'| cut -d'|' -f2)

  ATUAL=$(grep 'iniciando' "$LOG" 2>/dev/null | tail -1 | awk '{print $3}')
  ARQ=$(ls -d "$CACHE"/parquet/RD${ATUAL}*.parquet 2>/dev/null | wc -l | tr -d ' ')
  RITMO=$(find "$CACHE/parquet" -mmin -2 2>/dev/null | wc -l | tr -d ' ')
  IDLE=$(( ($(date +%s) - $(stat -f %m "$LOG" 2>/dev/null || echo 0)) / 60 ))
  VIVA=$(pgrep -f "sih_pipeline.cli collect" >/dev/null && echo "rodando" || echo "PARADA")
  DISCO=$(df -h / | tail -1 | awk '{print $4}')
  # esperado = maior contagem de arquivos entre as UFs completas (cobre 2026 parcial,
  # que o antigo /156 cravado ignorava -- por isso aparecia 158/156)
  ESPERADO=$(python3 -c "
import json,os,collections
led=json.load(open(os.path.expanduser('~/.lacir/sih-cache/ledger/files.json')))
reg=led.get('arquivos',led)
c=collections.Counter(k[2:4] for k in reg if k.startswith('RD'))
print(max(c.values()) if c else 156)" 2>/dev/null || echo 156)

  clear
  echo "  SIH — coleta incremental                            $(date +%H:%M:%S)"
  echo "  ──────────────────────────────────────────────────────────────────"
  printf "  UFs      [%s] %2d/27  %3d%%\n" "$BARRA" "$NOK" "$PCT"
  printf "  Atual     %-3s  %3d/%s arquivos\n" "${ATUAL:-—}" "$ARQ" "$ESPERADO"
  printf "  Ritmo     %-4s arq/2min     Disco %-6s   [%s, %smin sem log]\n" "$RITMO" "$DISCO" "$VIVA" "$IDLE"
  printf "  Linhas    %s agregadas\n" "$LINHAS"
  echo "  ──────────────────────────────────────────────────────────────────"
  echo "  ✓ prontas: $OKS"
  [ -n "$BADS" ]  && echo "  ✗ refazer: $BADS"
  [ -n "$TODOS" ] && echo "  ○ faltam:  $TODOS"
  echo
  tail -2 "$LOG" 2>/dev/null | cut -c1-68 | sed 's/^/  /'
  sleep 10
done

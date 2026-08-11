#!/bin/bash
# Acompanhamento ao vivo da coleta SIH. Ctrl+C para sair.
CACHE="$HOME/.lacir/sih-cache"
LOG="$(cd "$(dirname "$0")" && pwd)/reports/collect.log"
ORDEM="DF RR AP SE AC AL TO RO RN PB PI AM ES MS MT PE RJ CE PA GO MA SC PR RS BA MG SP"
ANT=0; T0=$(date +%s)
while true; do
  PRONTAS=$(ls "$CACHE"/agregados/*.parquet 2>/dev/null | wc -l | tr -d ' ')
  PCT=$(( PRONTAS * 100 / 27 ))
  BARRA=$(printf '█%.0s' $(seq 1 $((PCT/5)) 2>/dev/null))$(printf '░%.0s' $(seq 1 $((20-PCT/5)) 2>/dev/null))
  ATUAL=$(grep 'iniciando' "$LOG" 2>/dev/null | tail -1 | awk '{print $3}')
  BAIXADOS=$(ls -d "$CACHE"/parquet/RD${ATUAL}*.parquet 2>/dev/null | wc -l | tr -d ' ')
  PENDENTES=$(ls "$CACHE"/parquet/RD${ATUAL}*.dbc 2>/dev/null | wc -l | tr -d ' ')
  PCTUF=$(( BAIXADOS * 100 / 156 ))
  RITMO=$(find "$CACHE/parquet" -mmin -2 2>/dev/null | wc -l | tr -d ' ')
  DISCO=$(df -h / | tail -1 | awk '{print $4}')
  FALTAM=""; for u in $ORDEM; do [ -f "$CACHE/agregados/$u.parquet" ] || FALTAM="$FALTAM $u"; done
  VIVA=$(pgrep -f "sih_pipeline.cli collect" >/dev/null && echo "rodando" || echo "PARADA")
  clear
  echo "  SIH — coleta incremental                      $(date +%H:%M:%S)"
  echo "  ────────────────────────────────────────────────────────────"
  printf "  UFs     [%s] %2d/27  %3d%%\n" "$BARRA" "$PRONTAS" "$PCT"
  printf "  Atual    %-4s  %3d/156 arquivos  (%d%%)   %d convertendo\n" "${ATUAL:-—}" "$BAIXADOS" "$PCTUF" "$PENDENTES"
  printf "  Ritmo    %s arq/2min        Disco  %s livres     [%s]\n" "$RITMO" "$DISCO" "$VIVA"
  echo "  ────────────────────────────────────────────────────────────"
  echo "  Faltam:$FALTAM"
  echo
  tail -2 "$LOG" 2>/dev/null | cut -c1-72 | sed 's/^/  /'
  sleep 10
done

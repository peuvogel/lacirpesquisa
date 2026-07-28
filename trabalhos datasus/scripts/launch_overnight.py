#!/usr/bin/env python3
"""Detach overnight SIH scrape→Supabase watchdog (survives terminal close)."""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "trabalhos datasus/outputs/coleta_sih_multi"
SCRIPT = ROOT / "trabalhos datasus/scripts/overnight_watchdog.sh"
PID_FILE = OUT / "watchdog.pid"
LOG = OUT / "watchdog_stdout.log"


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    if PID_FILE.exists():
        try:
            old = int(PID_FILE.read_text().strip())
            # Signal 0 — still alive?
            import os

            os.kill(old, 0)
            print(f"already running pid={old}", file=sys.stderr)
            return 0
        except (OSError, ValueError):
            pass

    with LOG.open("a", encoding="utf-8") as fh:
        proc = subprocess.Popen(
            ["bash", str(SCRIPT)],
            cwd=str(ROOT),
            stdin=subprocess.DEVNULL,
            stdout=fh,
            stderr=subprocess.STDOUT,
            start_new_session=True,
        )
    PID_FILE.write_text(str(proc.pid), encoding="utf-8")
    print(f"started pid={proc.pid}")
    print(f"log: {OUT / 'overnight_scrape_upload.log'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

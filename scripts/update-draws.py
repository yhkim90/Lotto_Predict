#!/usr/bin/env python3
"""Download official 6/45 draws and write compact data/draws.json."""
from __future__ import annotations

import json
import urllib.request
from datetime import datetime
from pathlib import Path

URL = "https://www.dhlottery.co.kr/lt645/selectPstLt645Info.do?srchLtEpsd=all"
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "draws.json"


def parse_date(raw: str) -> str:
    raw = str(raw).strip()
    if len(raw) == 8 and raw.isdigit():
        return f"{raw[0:4]}-{raw[4:6]}-{raw[6:8]}"
    return raw


def main() -> None:
    req = urllib.request.Request(
        URL,
        headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "application/json",
            "X-Requested-With": "XMLHttpRequest",
            "Referer": "https://www.dhlottery.co.kr/",
        },
    )
    with urllib.request.urlopen(req, timeout=120) as res:
        payload = json.loads(res.read().decode("utf-8"))

    rows = payload["data"]["list"]
    draws = []
    for item in rows:
        nums = sorted(
            int(item[key])
            for key in ("tm1WnNo", "tm2WnNo", "tm3WnNo", "tm4WnNo", "tm5WnNo", "tm6WnNo")
        )
        draws.append(
            {
                "n": int(item["ltEpsd"]),
                "d": parse_date(item["ltRflYmd"]),
                "nums": nums,
                "b": int(item["bnsWnNo"]),
            }
        )
    draws.sort(key=lambda d: d["n"])
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(
        json.dumps(
            {
                "source": "dhlottery",
                "updatedAt": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "count": len(draws),
                "min": draws[0]["n"],
                "max": draws[-1]["n"],
                "draws": draws,
            },
            ensure_ascii=False,
            separators=(",", ":"),
        ),
        encoding="utf-8",
    )
    print(f"wrote {len(draws)} draws ({draws[0]['n']}~{draws[-1]['n']}) to {OUT}")


if __name__ == "__main__":
    main()

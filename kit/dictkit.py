#!/usr/bin/env python3
"""Train a zstd dictionary and bench it on a held-out slice of the corpus."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import random
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path

MIN_PY = (3, 9)
if sys.version_info < MIN_PY:
    sys.exit("dictkit needs Python 3.9+")

SKIP_SUFFIXES = {".zdict", ".zst", ".pyc"}
SKIP_NAMES = {"LICENSE", "README.md", "dictkit.py", ".gitignore"}


def fail(message: str, code: int = 2) -> None:
    print(f"dictkit: {message}", file=sys.stderr)
    raise SystemExit(code)


def zstd_bin() -> str:
    path = shutil.which("zstd")
    if not path:
        fail("zstd is not on PATH. Install the zstd CLI and retry.")
    return path


def run_zstd(args: list[str], *, check: bool = True) -> subprocess.CompletedProcess[bytes]:
    try:
        return subprocess.run(
            [zstd_bin(), *args],
            check=check,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
    except subprocess.CalledProcessError as exc:
        err = exc.stderr.decode("utf-8", "replace").strip() or str(exc)
        fail(f"zstd failed ({exc.returncode}): {err}")
        raise


def iter_corpus_files(root: Path) -> list[Path]:
    if not root.exists():
        fail(f"corpus not found: {root}")
    files: list[Path] = []
    for path in sorted(root.rglob("*")):
        if not path.is_file():
            continue
        if path.name in SKIP_NAMES or path.suffix in SKIP_SUFFIXES:
            continue
        if any(part.startswith(".") for part in path.relative_to(root).parts):
            continue
        files.append(path)
    if not files:
        fail(f"no files under {root}")
    return files


def split_files(
    files: list[Path], split: float, seed: int
) -> tuple[list[Path], list[Path]]:
    if not 0.5 <= split < 1.0:
        fail("--split must be in [0.5, 1.0)")
    keyed = []
    for path in files:
        digest = hashlib.sha256(f"{seed}:{path.as_posix()}".encode()).hexdigest()
        keyed.append((digest, path))
    keyed.sort()
    cut = max(1, int(len(keyed) * split))
    if cut >= len(keyed):
        cut = len(keyed) - 1
    train = [p for _, p in keyed[:cut]]
    holdout = [p for _, p in keyed[cut:]]
    if not train or not holdout:
        fail("corpus is too small to split; add more files")
    return train, holdout


def write_list(path: Path, files: list[Path]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("".join(f"{f.as_posix()}\n" for f in files), encoding="utf-8")


def read_list(path: Path) -> list[Path]:
    if not path.exists():
        fail(f"holdout list not found: {path}")
    files = []
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line:
            files.append(Path(line))
    if not files:
        fail(f"holdout list is empty: {path}")
    return files


def train_dictionary(train_files: list[Path], dict_path: Path, maxdict: int) -> None:
    if maxdict < 1024:
        fail("--maxdict is too small (use at least 1024)")
    dict_path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="dictkit-train-") as tmp:
        staged = Path(tmp)
        for src in train_files:
            dest = staged / src.name
            n = 0
            while dest.exists():
                n += 1
                dest = staged / f"{src.stem}-{n}{src.suffix}"
            try:
                os.link(src, dest)
            except OSError:
                shutil.copy2(src, dest)
        run_zstd(
            [
                "--train",
                "-r",
                str(staged),
                "-o",
                str(dict_path),
                f"--maxdict={maxdict}",
            ]
        )


def compressed_size(src: Path, level: int, dict_path: Path | None) -> int:
    args = [f"-{level}", "-c", "--no-progress", "-q"]
    if dict_path is not None:
        args.extend(["-D", str(dict_path)])
    args.append(str(src))
    result = run_zstd(args)
    return len(result.stdout)


def timed_compress(files: list[Path], level: int, dict_path: Path | None) -> float:
    args_prefix = [f"-{level}", "-c", "--no-progress", "-q"]
    if dict_path is not None:
        args_prefix.extend(["-D", str(dict_path)])
    start = time.perf_counter()
    for src in files:
        run_zstd([*args_prefix, str(src)])
    return time.perf_counter() - start


def fmt_bytes(n: int) -> str:
    if n < 1024:
        return f"{n} B"
    if n < 1024 * 1024:
        return f"{n / 1024:.1f} KiB"
    return f"{n / (1024 * 1024):.2f} MiB"


def print_report(report: dict, *, json_out: bool) -> None:
    payload = json.dumps(report, indent=2)
    if json_out:
        print(payload)
        return
    totals = report["totals"]
    print(f"corpus:     {report['corpus']}", file=sys.stderr)
    print(f"dict:       {report['dict']} ({fmt_bytes(report['dict_bytes'])})", file=sys.stderr)
    print(f"level:      {report['level']}", file=sys.stderr)
    print(
        f"split:      train {report['train_files']} files / holdout {report['holdout_files']} files",
        file=sys.stderr,
    )
    print("", file=sys.stderr)
    print(
        f"{'file':<28} {'raw':>8} {'plain':>8} {'dict':>8} {'saved':>8}",
        file=sys.stderr,
    )
    for row in report["files"]:
        name = row["name"]
        if len(name) > 27:
            name = "…" + name[-26:]
        print(
            f"{name:<28} {row['raw']:>8} {row['plain']:>8} {row['dict']:>8} {row['saved']:>8}",
            file=sys.stderr,
        )
    print("", file=sys.stderr)
    saved = totals["saved"]
    ratio = totals["ratio"]
    print(
        f"holdout raw {fmt_bytes(totals['raw'])}  "
        f"plain {fmt_bytes(totals['plain'])}  "
        f"dict {fmt_bytes(totals['dict'])}  "
        f"saved {saved:+d} B  "
        f"ratio {ratio:.3f}",
        file=sys.stderr,
    )
    print(
        f"compress wall  plain {totals['plain_s']:.3f}s  dict {totals['dict_s']:.3f}s",
        file=sys.stderr,
    )
    if saved > 0:
        print("holdout: dictionary helped.", file=sys.stderr)
    elif saved == 0:
        print("holdout: wash. dictionary did not change the size.", file=sys.stderr)
    else:
        print("holdout: dictionary lost. do not ship it.", file=sys.stderr)


def bench(
    files: list[Path],
    dict_path: Path,
    level: int,
    corpus: Path,
    train_count: int,
) -> dict:
    if not dict_path.exists():
        fail(f"dictionary not found: {dict_path}")
    rows = []
    for src in files:
        raw = src.stat().st_size
        plain = compressed_size(src, level, None)
        with_dict = compressed_size(src, level, dict_path)
        rows.append(
            {
                "name": src.name,
                "path": src.as_posix(),
                "raw": raw,
                "plain": plain,
                "dict": with_dict,
                "saved": plain - with_dict,
            }
        )
    plain_s = timed_compress(files, level, None)
    dict_s = timed_compress(files, level, dict_path)
    raw_total = sum(r["raw"] for r in rows)
    plain_total = sum(r["plain"] for r in rows)
    dict_total = sum(r["dict"] for r in rows)
    return {
        "corpus": str(corpus),
        "dict": str(dict_path),
        "dict_bytes": dict_path.stat().st_size,
        "level": level,
        "train_files": train_count,
        "holdout_files": len(files),
        "files": rows,
        "totals": {
            "raw": raw_total,
            "plain": plain_total,
            "dict": dict_total,
            "saved": plain_total - dict_total,
            "ratio": (dict_total / plain_total) if plain_total else 1.0,
            "plain_s": round(plain_s, 4),
            "dict_s": round(dict_s, 4),
        },
    }


BUOY_STATIONS = (
    "H-04",
    "H-09",
    "H-12",
    "K-02",
    "K-18",
    "M-01",
    "M-07",
    "R-15",
)
NOTES = (
    "chop from the southwest",
    "fog bank inland, water still readable",
    "gulls on the cage, ignore the extra motion",
    "swell period stretched after dusk",
    "rain streaking the anemometer",
    "current set to the east of the mark",
    "quiet, almost a lake",
    "whitecaps on the outer bar",
)


def generate_demo_corpus(dest: Path, count: int, seed: int) -> None:
    if dest.exists():
        shutil.rmtree(dest)
    dest.mkdir(parents=True)
    rng = random.Random(seed)
    for i in range(count):
        station = BUOY_STATIONS[i % len(BUOY_STATIONS)]
        hour = i % 24
        record = {
            "v": 1,
            "kind": "buoy.sample",
            "buoy": station,
            "seq": 10_000 + i,
            "lat": round(41.1 + (i % 9) * 0.03, 4),
            "lon": round(-72.4 + (i % 7) * 0.02, 4),
            "wave_cm": 40 + (i * 7) % 180,
            "wind_kt": round(3.5 + (i % 23) * 0.7, 1),
            "vis_km": round(4.0 + (i % 11) * 0.8, 1),
            "hour_utc": hour,
            "ok": i % 17 != 0,
            "note": NOTES[i % len(NOTES)],
            "extra": {
                "battery_mv": 11800 + (i * 13) % 900,
                "uptime_s": 3600 * (i % 48),
                "fw": "buoy-r3.4",
            },
        }
        # Pad a little so each file is a real object, not a toy line.
        record["pad"] = rng.randbytes(24).hex()
        path = dest / f"{station}-{i:04d}.json"
        path.write_text(json.dumps(record, indent=2) + "\n", encoding="utf-8")


def cmd_train(args: argparse.Namespace) -> None:
    zstd_bin()
    corpus = Path(args.corpus).resolve()
    files = iter_corpus_files(corpus)
    train, holdout = split_files(files, args.split, args.seed)
    dict_path = Path(args.dict).resolve()
    holdout_list = Path(args.holdout).resolve() if args.holdout else dict_path.with_suffix(".holdout.txt")
    train_dictionary(train, dict_path, args.maxdict)
    write_list(holdout_list, holdout)
    print(
        f"dictkit: wrote {dict_path} ({dict_path.stat().st_size} B) "
        f"from {len(train)} files; holdout list {holdout_list} ({len(holdout)} files)",
        file=sys.stderr,
    )


def cmd_bench(args: argparse.Namespace) -> None:
    zstd_bin()
    corpus = Path(args.corpus).resolve()
    dict_path = Path(args.dict).resolve()
    if args.all:
        files = iter_corpus_files(corpus)
        train_count = 0
    else:
        if not args.holdout:
            fail("bench on the holdout needs --holdout (or pass --all)")
        files = read_list(Path(args.holdout).resolve())
        train_count = max(0, len(iter_corpus_files(corpus)) - len(files))
    report = bench(files, dict_path, args.level, corpus, train_count)
    print_report(report, json_out=args.json)


def cmd_run(args: argparse.Namespace) -> None:
    zstd_bin()
    corpus = Path(args.corpus).resolve()
    files = iter_corpus_files(corpus)
    train, holdout = split_files(files, args.split, args.seed)
    work = Path(args.work).resolve()
    work.mkdir(parents=True, exist_ok=True)
    dict_path = work / "trained.zdict"
    holdout_list = work / "holdout.txt"
    train_dictionary(train, dict_path, args.maxdict)
    write_list(holdout_list, holdout)
    report = bench(holdout, dict_path, args.level, corpus, len(train))
    report["holdout_list"] = str(holdout_list)
    print_report(report, json_out=args.json)


def cmd_demo(args: argparse.Namespace) -> None:
    zstd_bin()
    work = Path(args.work).resolve()
    corpus = work / "corpus"
    generate_demo_corpus(corpus, args.count, args.seed)
    args.corpus = str(corpus)
    args.work = str(work)
    cmd_run(args)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="dictkit",
        description="Train a zstd dictionary and bench it on held-out files.",
    )
    sub = parser.add_subparsers(dest="cmd", required=True)

    def add_common(p: argparse.ArgumentParser) -> None:
        p.add_argument("--split", type=float, default=0.8, help="train fraction, default 0.8")
        p.add_argument("--seed", type=int, default=1)
        p.add_argument("--maxdict", type=int, default=8192)
        p.add_argument("--level", type=int, default=3)
        p.add_argument("--json", action="store_true", help="print the report as JSON")

    train = sub.add_parser("train", help="train a dictionary and write a holdout list")
    train.add_argument("corpus")
    train.add_argument("--dict", default="trained.zdict")
    train.add_argument("--holdout", default=None)
    add_common(train)
    train.set_defaults(func=cmd_train)

    bench_p = sub.add_parser("bench", help="compress holdout files with and without the dict")
    bench_p.add_argument("corpus")
    bench_p.add_argument("--dict", required=True)
    bench_p.add_argument("--holdout", default=None)
    bench_p.add_argument("--all", action="store_true", help="bench every file (overfits; not the default)")
    bench_p.add_argument("--level", type=int, default=3)
    bench_p.add_argument("--json", action="store_true")
    bench_p.set_defaults(func=cmd_bench)

    run = sub.add_parser("run", help="split, train, and bench in one go")
    run.add_argument("corpus")
    run.add_argument("--work", default="dictkit-work")
    add_common(run)
    run.set_defaults(func=cmd_run)

    demo = sub.add_parser("demo", help="generate a synthetic corpus, then run")
    demo.add_argument("--work", default="dictkit-work")
    demo.add_argument("--count", type=int, default=240)
    add_common(demo)
    demo.set_defaults(func=cmd_demo)

    return parser


def main(argv: list[str] | None = None) -> None:
    parser = build_parser()
    args = parser.parse_args(argv)
    args.func(args)


if __name__ == "__main__":
    main()

# zstd dictionary kit

Train a zstd dictionary on a folder of similar files. Then compress a holdout the trainer never saw, so you know whether the dictionary actually saves bytes.

This GitHub repo is the product site. The product itself is the `kit/` folder: a Python CLI, a short guide, and a few sample records. Polar sells it as a $12 one-time download under the SenWorks organization and delivers a zip of `kit/` the moment checkout finishes.

You get software. You run it on your machine. There is no custom job, no human fulfillment, and nothing to file.

## What you download

| File | What it is |
| --- | --- |
| `dictkit.py` | Split a corpus, train a dictionary, bench the holdout |
| `README.md` | The same guide, shipped with the zip |
| `samples/` | A handful of synthetic buoy-telemetry JSON records, so you can see the shape |
| `LICENSE` | MIT |

`samples/` is too small to train on. Use `python3 dictkit.py demo` for a synthetic corpus, or point `run` at your own files.

## Price

$12, one-time, via Polar (SenWorks). Instant digital download. Not a subscription.

[Buy the kit](https://buy.polar.sh/polar_cl_X62sEcNs7MOhIzUb4yNIq1xAxBo8KYh2J7qZy19cErK)

## Need

Python 3.9+ (stdlib only) and the `zstd` CLI on your PATH.

```bash
# Debian/Ubuntu
sudo apt install zstd

# macOS
brew install zstd
```

## Run it

From `kit/`:

```bash
python3 dictkit.py demo
```

That generates a synthetic corpus, trains an 8 KiB dictionary on 80% of it, and benches the other 20%.

On your own files:

```bash
python3 dictkit.py run ./my-corpus --maxdict 8192 --level 3 --split 0.8
```

Or the pieces:

```bash
python3 dictkit.py train ./my-corpus --dict ./out.zdict --split 0.8
python3 dictkit.py bench ./my-corpus --dict ./out.zdict --holdout ./out.holdout.txt
```

`train` writes a dictionary and a holdout list. `bench` compresses only those holdout paths unless you pass `--all`, which is the vanity number. `--json` prints the report as JSON on stdout. Human text stays on stderr.

## Reading the report

- **raw**: uncompressed bytes
- **plain**: zstd with no dictionary
- **dict**: zstd with the trained dictionary
- **saved**: plain minus dict. Negative means the dictionary lost.
- **ratio**: dict / plain. Below 1.0 is a win.

If saved is tiny, raise `--maxdict` a step (16 KiB, 32 KiB) or collect a corpus that actually shares strings. If saved is negative on the holdout, the dictionary does not generalize. Throw it away.

Timings are wall-clock for the whole holdout, not a serious profiler. Use them to catch "this dict makes compression slower and saves nothing."

## When it helps

zstd already finds repeated bytes inside a single buffer. It cannot see the next file. Small, similarly shaped records (JSON events, log lines, HTML fragments) each pay the same header tax and re-encode the same keys. A dictionary is a bag of those shared fragments, built ahead of time. The compressor may point into it. The decoder needs the same bag.

Use this kit when files are small, the schema repeats, and you can ship the dictionary next to the decoder.

Skip it when files are large and already internally redundant, the payload is already compressed or encrypted, or every record is a unique blob with no shared skeleton.

Do not train on secrets and then publish the dict. The dict can contain literals from the training set.

## This site

The Next.js app in `app/` is a product page for the kit. `GET /api/health` answers `{ "ok": true }`. The download is the zip Polar sends, not a form on this page.

## License

MIT. See [`kit/LICENSE`](./kit/LICENSE).

# zstd dictionary kit

A small CLI that trains a zstd dictionary on a corpus of similar files and then
measures whether the dictionary actually saves bytes on files the trainer did
not see.

That last part is the point. Training and testing on the same records flatters
the dictionary. This kit splits the corpus first, trains on one side, and
reports sizes on the holdout.

This folder is the product. Polar (SenWorks) sells it as a $12 one-time
download and delivers a zip of these files automatically.

[Buy the kit](https://buy.polar.sh/polar_cl_X62sEcNs7MOhIzUb4yNIq1xAxBo8KYh2J7qZy19cErK)

## What a dictionary is for

zstd already finds repeated bytes inside a single buffer. It cannot see the
next file. If you compress a pile of small, similarly shaped records (JSON
events, log lines, HTML fragments, protobuf-ish dumps), each file pays the
same header tax and re-encodes the same keys.

A dictionary is a bag of those shared fragments, built ahead of time. The
compressor is allowed to point into it. The decoder needs the same bag. If
the next file does not look like the training set, the bag is dead weight
and the "with dict" size can get worse.

Use this kit when:

- files are small (hundreds of bytes to a few tens of KB)
- the schema or boilerplate repeats
- you can ship the dictionary next to the decoder

Skip it when:

- files are large and already internally redundant
- the payload is already compressed or encrypted
- every record is a unique blob with no shared skeleton

## Need

The `zstd` CLI on your PATH. Python 3.9+ (stdlib only).

Debian/Ubuntu: `sudo apt install zstd`

macOS: `brew install zstd`

## Commands

From this directory:

```bash
python3 dictkit.py demo
```

That generates a synthetic buoy-telemetry corpus, trains an 8 KiB dictionary
on 80% of it, and benches the other 20%. `samples/` is a handful of those
records so you can see the shape; it is too small to train on.

On your own files:

```bash
python3 dictkit.py run ./my-corpus --maxdict 8192 --level 3 --split 0.8
```

Pieces:

```bash
python3 dictkit.py train ./my-corpus --dict ./out.zdict --split 0.8
python3 dictkit.py bench ./my-corpus --dict ./out.zdict --holdout ./out.holdout.txt
```

`train` writes a dictionary and a holdout list. `bench` compresses only those
holdout paths unless you pass `--all` (which is the vanity number; do not
sell anyone that).

`--json` prints the report as JSON on stdout. Human text stays on stderr.

## Reading the report

- **raw**: uncompressed bytes
- **plain**: zstd with no dictionary
- **dict**: zstd with the trained dictionary
- **saved**: plain minus dict. Negative means the dictionary lost.
- **ratio**: dict / plain. Below 1.0 is a win.

If saved is tiny, raise `--maxdict` a step (16 KiB, 32 KiB) or collect a
corpus that actually shares strings. If saved is negative on the holdout, the
dictionary does not generalize. Throw it away.

Timings are wall-clock for the whole holdout, not a serious profiler. Use
them to catch "this dict makes compression slower and saves nothing."

## Shipping a dictionary

Keep the dict file next to the code that decompresses. Both sides pass it in
(`zstd -D`, or the matching API in your language). Treat the dict as a
versioned artifact: if you retrain, bump a name or id so old payloads still
decode with the old dict.

Do not train on production secrets and then publish the dict. The dict can
contain literals from the training set.

## License

MIT. See `LICENSE`.

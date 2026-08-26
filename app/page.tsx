import { KitBuy } from "@/components/kit-buy";

export default function HomePage() {
  return (
    <main>
      <header className="masthead">
        <h1>zstd dictionary kit</h1>
        <span className="price">$12</span>
      </header>

      <p className="lede">
        Train a dictionary. Bench it on files the trainer never saw.{" "}
        <em>Download the zip and run it yourself.</em>
      </p>

      <div className="prose">
        <p>
          zstd already squeezes repeats inside one buffer. It cannot see the
          next file. If you compress a pile of small, similarly shaped
          records, each one pays the same header tax and re-encodes the same
          keys.
        </p>
        <p>
          This kit trains a dictionary on one slice of a corpus and reports
          sizes on the holdout. Training and testing on the same records
          flatters the dictionary. The holdout is the number that matters.
        </p>
      </div>

      <KitBuy />

      <div className="split">
        <section>
          <h2>Use it when</h2>
          <ul>
            <li>files are small, hundreds of bytes to a few tens of KB</li>
            <li>the schema or boilerplate repeats</li>
            <li>you can ship the dict next to the decoder</li>
          </ul>
        </section>
        <section>
          <h2>Skip it when</h2>
          <ul>
            <li>files are large and already internally redundant</li>
            <li>the payload is already compressed or encrypted</li>
            <li>every record is a unique blob</li>
          </ul>
        </section>
      </div>

      <section className="contents">
        <h2>What is in the zip</h2>
        <ul>
          <li>
            <code>dictkit.py</code>, which splits, trains, and benches
          </li>
          <li>
            <code>README.md</code>, the guide
          </li>
          <li>
            <code>samples/</code>, a few synthetic buoy JSON records (too
            small to train on)
          </li>
          <li>
            <code>LICENSE</code>, MIT
          </li>
        </ul>
      </section>

      <section className="commands">
        <h2>Run it</h2>
        <p>
          Python 3.9+ and the <code>zstd</code> CLI on PATH. From the unzipped
          kit:
        </p>
        <pre>
          <code>python3 dictkit.py demo</code>
        </pre>
        <p>On your own files:</p>
        <pre>
          <code>{`python3 dictkit.py run ./my-corpus --maxdict 8192 --level 3 --split 0.8`}</code>
        </pre>
      </section>

      <p className="foot">
        Scrappy is the GitHub name of this product page. Sold by SenWorks on
        Polar. MIT licensed software, not a custom job.
      </p>
    </main>
  );
}

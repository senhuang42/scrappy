const CHECKOUT_URL =
  "https://buy.polar.sh/polar_cl_X62sEcNs7MOhIzUb4yNIq1xAxBo8KYh2J7qZy19cErK";

export function KitBuy() {
  return (
    <aside className="buy">
      <p className="buy-kicker">Instant digital download</p>
      <p className="buy-lead">
        $12, one time, via Polar (SenWorks). Polar sends a zip of{" "}
        <code>kit/</code> as soon as checkout finishes.
      </p>
      <a
        className="buy-button"
        href={CHECKOUT_URL}
        target="_blank"
        rel="noreferrer"
      >
        Buy the kit
      </a>
      <p className="fine">
        You get the trainer, the guide, and the samples. You run them locally
        on your own corpus. No subscription, no waiting on a person.
      </p>
    </aside>
  );
}

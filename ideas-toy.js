/* The toy population on the rehearsal market idea page. Every number here is
   invented to show the shape of the idea: no AI runs and nothing is predicted. */
(() => {
  const toy = document.querySelector("[data-toy]");
  if (!toy) return;

  const SIDE = 20;
  const CELL = 400 / SIDE;
  const SPARE_MONEY = { low: [20, 80], mid: [50, 180], high: [150, 500] };
  const BANDS = ["low", "mid", "high"];
  const MID_SHARE_OF_REST = 0.7;

  // Seeded so that the same 400 people come back on every visit.
  let seed = 42;
  const random = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const dotsEl = toy.querySelector("[data-dots]");
  const people = Array.from({ length: SIDE * SIDE }, (_, i) => {
    const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    dot.setAttribute("cx", (i % SIDE) * CELL + CELL / 2);
    dot.setAttribute("cy", Math.floor(i / SIDE) * CELL + CELL / 2);
    dot.setAttribute("r", CELL * 0.34);
    dotsEl.append(dot);
    return {
      dot,
      bandDraw: random(),
      moneyDraw: random(),
      wantsToPay: 10 + random() * 90,
      awarenessDraw: random(),
    };
  });

  const input = (name) => toy.querySelector(`[data-in="${name}"]`);
  const output = (name) => toy.querySelector(`[data-out="${name}"]`);

  const bandOf = (person, lowShare) => {
    if (person.bandDraw < lowShare) return "low";
    const midCutoff = lowShare + (1 - lowShare) * MID_SHARE_OF_REST;
    return person.bandDraw < midCutoff ? "mid" : "high";
  };

  const render = () => {
    const price = Number(input("price").value);
    const lowShare = Number(input("low").value) / 100;
    const awareShare = Number(input("aware").value) / 100;
    output("price").textContent = `$${price}`;
    output("low").textContent = `${input("low").value}%`;
    output("aware").textContent = `${input("aware").value}%`;

    const counts = { buyer: 0, uninterested: 0, broke: 0, unaware: 0 };
    const bandTotals = { low: 0, mid: 0, high: 0 };
    const bandBuyers = { low: 0, mid: 0, high: 0 };

    people.forEach((person) => {
      const band = bandOf(person, lowShare);
      const [min, max] = SPARE_MONEY[band];
      const spare = min + person.moneyDraw * (max - min);
      let state = "buyer";
      if (person.awarenessDraw >= awareShare) state = "unaware";
      else if (price > spare) state = "broke";
      else if (price > person.wantsToPay) state = "uninterested";

      counts[state] += 1;
      bandTotals[band] += 1;
      if (state === "buyer") bandBuyers[band] += 1;
      person.dot.setAttribute("class", `is-${state}`);
    });

    Object.entries(counts).forEach(([state, count]) => {
      toy.querySelector(`[data-count="${state}"]`).textContent = count;
    });
    toy.querySelector("[data-bands]").innerHTML = `<strong>Buyers by income:</strong> ${BANDS.map(
      (band) => `${band} ${bandBuyers[band]} of ${bandTotals[band]}`,
    ).join(" · ")}`;
  };

  toy.addEventListener("input", render);
  render();
})();

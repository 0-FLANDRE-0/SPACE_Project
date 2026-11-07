import { Ledger } from "./economy-energy-ledger.js";
export const NATIONAL_C43 = "nation/government/C";
const government = (k) => /^(earth|moon|mars)\/government\/C$/.test(k),
  canonical = (k) => (government(k) ? NATIONAL_C43 : k);
const body = (k) => (/^(earth|moon|mars)\//.test(k) ? k.split("/")[0] : null);
const fresh = () =>
  Object.fromEntries(
    ["earth", "moon", "mars"].map((id) => [
      id,
      { taxQ: 0, inQ: 0, outQ: 0, byTag: {} },
    ]),
  );
// Canonical cash only. Raw planet aliases remain call-site labels, never balances.
export class NationalLedger43 extends Ledger {
  constructor(old) {
    super({ trace: Boolean(old.trace) });
    for (const key of ["balance", "expected", "initial"]) {
      this[key] = {};
      for (const [k, n] of Object.entries(old[key]))
        this[key][canonical(k)] = (this[key][canonical(k)] ?? 0) + n;
    }
    for (const key of ["sources", "sinks", "turnover"])
      this[key] = { ...old[key] };
    if (old.trace) this.trace = structuredClone(old.trace);
    this.fiscal43 = fresh();
    this.totalFiscal43 = fresh();
    this.month43 = 0;
  }
  get(k) {
    return super.get(canonical(k));
  }
  open(k, n) {
    return super.open(canonical(k), n);
  }
  ensure(k) {
    return super.ensure(canonical(k));
  }
  move(from, to, n, tag = "transfer") {
    const a = canonical(from),
      b = canonical(to);
    if (a === b && a === NATIONAL_C43) {
      if (!Number.isSafeInteger(n) || n < 0)
        throw Error("43 invalid internal cash");
      return 0;
    }
    const previous = this.label43;
    this.label43 = { from, to };
    try {
      return super.move(a, b, n, tag);
    } finally {
      this.label43 = previous;
    }
  }
  source(to, n, tag) {
    const previous = this.label43;
    this.label43 = { from: null, to };
    try {
      return super.source(canonical(to), n, tag);
    } finally {
      this.label43 = previous;
    }
  }
  sink(from, n, tag) {
    const previous = this.label43;
    this.label43 = { from, to: null };
    try {
      return super.sink(canonical(from), n, tag);
    } finally {
      this.label43 = previous;
    }
  }
  record(tag, n, from, to) {
    super.record(tag, n, from, to);
    const raw = this.label43 ?? { from, to },
      out = from === NATIONAL_C43 && to !== NATIONAL_C43,
      inc = to === NATIONAL_C43 && from !== NATIONAL_C43;
    if (!out && !inc) return;
    const id =
      this.fiscalBodyOverride43 ??
      (out
        ? (body(raw.from) ?? body(raw.to))
        : (body(raw.to) ?? body(raw.from)));
    if (!id) throw Error("43 fiscal transaction missing planet");
    const fiscalTag = id + ":" + tag;
    for (const map of [this.fiscal43, this.totalFiscal43]) {
      const row = map[id];
      if (out) row.outQ += n;
      else row.inQ += n;
      if (inc && tag === "tax") row.taxQ += n;
      row.byTag[fiscalTag] = (row.byTag[fiscalTag] ?? 0) + (inc ? n : -n);
    }
    if (this.trace)
      Object.assign(this.trace.at(-1), {
        fiscalBody43: id,
        fiscalTag43: fiscalTag,
      });
  }
  withBody43(id, fn) {
    const before = this.fiscalBodyOverride43;
    this.fiscalBodyOverride43 = id;
    try {
      return fn();
    } finally {
      this.fiscalBodyOverride43 = before;
    }
  }
  begin43(month) {
    this.month43 = month;
    this.fiscal43 = fresh();
  }
  audit() {
    super.audit();
    if (Object.keys(this.balance).some(government))
      throw Error("43 duplicate treasury alias");
    return true;
  }
}

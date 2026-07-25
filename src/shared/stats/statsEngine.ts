/**
 * Full port of the legacy `Stats` object from `assets/js/app.js:240-533`.
 * Formulas are byte-for-byte unchanged — only TypeScript types were added.
 */

export interface WelchTResult {
  n1: number;
  n2: number;
  m1: number;
  m2: number;
  s1: number;
  s2: number;
  t: number;
  df: number;
  p: number;
  diff: number;
  ci: [number, number];
  d: number;
  se: number;
}

export interface PearsonResult {
  coef: number;
  p: number;
  n: number;
  ci: [number, number];
  r2: number;
  slope: number;
  intercept: number;
}

export interface OlsTransformedResult {
  alpha: number;
  beta: number;
  resid: number[];
  df: number;
  seBeta: number;
}

export interface PraisWinstenResult {
  n: number;
  rho: number;
  alpha: number;
  beta: number;
  seBeta: number;
  p: number;
  df: number;
  t: number;
  ciBeta: [number, number];
  apc: number;
  ciApc: [number, number];
  classification: 'estacionária' | 'crescente' | 'decrescente';
}

export const statsEngine = {
  parseNumber(raw: unknown): number | null {
    if (raw === null || raw === undefined) return null;
    if (typeof raw === 'number' && Number.isFinite(raw)) return raw;

    let source = String(raw).trim();
    if (!source) return null;

    source = source.replace(/\s+/g, '');
    if (source.includes(',') && source.includes('.')) {
      if (source.lastIndexOf(',') > source.lastIndexOf('.')) {
        source = source.replace(/\./g, '').replace(',', '.');
      } else {
        source = source.replace(/,/g, '');
      }
    } else if (source.includes(',') && !source.includes('.')) {
      source = source.replace(',', '.');
    }

    const value = Number(source);
    return Number.isFinite(value) ? value : null;
  },
  mean(arr: number[]): number {
    return arr.reduce((acc, value) => acc + value, 0) / arr.length;
  },
  variance(arr: number[]): number {
    if (arr.length < 2) return NaN;
    const mean = statsEngine.mean(arr);
    return arr.reduce((acc, value) => acc + ((value - mean) ** 2), 0) / (arr.length - 1);
  },
  sd(arr: number[]): number {
    return Math.sqrt(statsEngine.variance(arr));
  },
  sum(arr: number[]): number {
    return arr.reduce((acc, value) => acc + value, 0);
  },
  min(arr: number[]): number {
    return Math.min(...arr);
  },
  max(arr: number[]): number {
    return Math.max(...arr);
  },
  gammaln(x: number): number {
    const cof = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
    let ser = 1.000000000190015;
    let y = x;
    let tmp = x + 5.5;
    tmp -= (x + 0.5) * Math.log(tmp);

    for (let index = 0; index < cof.length; index += 1) {
      ser += cof[index] / ++y;
    }

    return -tmp + Math.log(2.5066282746310005 * ser / x);
  },
  betacf(a: number, b: number, x: number): number {
    const maxIterations = 200;
    const epsilon = 3e-7;
    const fpMin = 1e-30;
    const qab = a + b;
    const qap = a + 1;
    const qam = a - 1;
    let c = 1;
    let d = 1 - qab * x / qap;

    if (Math.abs(d) < fpMin) d = fpMin;
    d = 1 / d;
    let h = d;

    for (let m = 1; m <= maxIterations; m += 1) {
      const m2 = 2 * m;
      let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
      d = 1 + aa * d;
      if (Math.abs(d) < fpMin) d = fpMin;
      c = 1 + aa / c;
      if (Math.abs(c) < fpMin) c = fpMin;
      d = 1 / d;
      h *= d * c;

      aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
      d = 1 + aa * d;
      if (Math.abs(d) < fpMin) d = fpMin;
      c = 1 + aa / c;
      if (Math.abs(c) < fpMin) c = fpMin;
      d = 1 / d;
      const delta = d * c;
      h *= delta;
      if (Math.abs(delta - 1) < epsilon) break;
    }

    return h;
  },
  ibeta(x: number, a: number, b: number): number {
    if (x <= 0) return 0;
    if (x >= 1) return 1;

    const bt = Math.exp(
      statsEngine.gammaln(a + b)
      - statsEngine.gammaln(a)
      - statsEngine.gammaln(b)
      + (a * Math.log(x))
      + (b * Math.log(1 - x)),
    );

    if (x < (a + 1) / (a + b + 2)) return bt * statsEngine.betacf(a, b, x) / a;
    return 1 - bt * statsEngine.betacf(b, a, 1 - x) / b;
  },
  tcdf(t: number, df: number): number {
    if (!Number.isFinite(t) || !Number.isFinite(df) || df <= 0) return NaN;
    if (t === 0) return 0.5;

    const x = df / (df + (t * t));
    const ib = statsEngine.ibeta(x, df / 2, 0.5);
    return t > 0 ? 1 - (0.5 * ib) : 0.5 * ib;
  },
  tInv(p: number, df: number): number {
    if (p <= 0 || p >= 1 || !Number.isFinite(df) || df <= 0) return NaN;

    let low = -50;
    let high = 50;
    for (let index = 0; index < 120; index += 1) {
      const mid = (low + high) / 2;
      const cdf = statsEngine.tcdf(mid, df);
      if (cdf < p) low = mid;
      else high = mid;
    }

    return (low + high) / 2;
  },
  fisherCI(r: number, n: number): [number, number] {
    if (!Number.isFinite(r) || n <= 3 || Math.abs(r) >= 1) return [NaN, NaN];

    const z = 0.5 * Math.log((1 + r) / (1 - r));
    const se = 1 / Math.sqrt(n - 3);
    const lowZ = z - (1.96 * se);
    const highZ = z + (1.96 * se);
    const low = (Math.exp(2 * lowZ) - 1) / (Math.exp(2 * lowZ) + 1);
    const high = (Math.exp(2 * highZ) - 1) / (Math.exp(2 * highZ) + 1);
    return [low, high];
  },
  welchT(a: number[], b: number[]): WelchTResult {
    const n1 = a.length;
    const n2 = b.length;
    const m1 = statsEngine.mean(a);
    const m2 = statsEngine.mean(b);
    const s1 = statsEngine.sd(a);
    const s2 = statsEngine.sd(b);
    const v1 = s1 * s1;
    const v2 = s2 * s2;
    const se = Math.sqrt((v1 / n1) + (v2 / n2));
    const t = (m1 - m2) / se;
    const df = (((v1 / n1) + (v2 / n2)) ** 2) / ((((v1 / n1) ** 2) / (n1 - 1)) + (((v2 / n2) ** 2) / (n2 - 1)));
    const p = 2 * (1 - statsEngine.tcdf(Math.abs(t), df));
    const tcrit = statsEngine.tInv(0.975, df);
    const diff = m1 - m2;
    const ci: [number, number] = [diff - (tcrit * se), diff + (tcrit * se)];
    const sp = Math.sqrt((((n1 - 1) * v1) + ((n2 - 1) * v2)) / (n1 + n2 - 2));
    const d = diff / sp;
    return { n1, n2, m1, m2, s1, s2, t, df, p, diff, ci, d, se };
  },
  pearson(x: number[], y: number[]): PearsonResult {
    const n = x.length;
    const mx = statsEngine.mean(x);
    const my = statsEngine.mean(y);
    let num = 0;
    let sx = 0;
    let sy = 0;

    for (let index = 0; index < n; index += 1) {
      const dx = x[index] - mx;
      const dy = y[index] - my;
      num += dx * dy;
      sx += dx * dx;
      sy += dy * dy;
    }

    const r = num / Math.sqrt(sx * sy);
    const t = r * Math.sqrt((n - 2) / (1 - (r * r)));
    const p = n < 3 ? NaN : 2 * (1 - statsEngine.tcdf(Math.abs(t), n - 2));
    const ci = statsEngine.fisherCI(r, n);
    const slope = num / sx;
    const intercept = my - (slope * mx);
    return { coef: r, p, n, ci, r2: r * r, slope, intercept };
  },
  rank(arr: number[]): number[] {
    const items = arr.map((value, index) => ({ value, index })).sort((a, b) => a.value - b.value);
    const ranks = new Array<number>(arr.length);
    let index = 0;

    while (index < items.length) {
      let end = index;
      while (end + 1 < items.length && items[end + 1].value === items[index].value) end += 1;
      const rank = (index + end + 2) / 2;
      for (let cursor = index; cursor <= end; cursor += 1) {
        ranks[items[cursor].index] = rank;
      }
      index = end + 1;
    }

    return ranks;
  },
  spearman(x: number[], y: number[]): PearsonResult {
    return statsEngine.pearson(statsEngine.rank(x), statsEngine.rank(y));
  },
  olsTransformed(c: number[], x: number[], y: number[]): OlsTransformedResult {
    const n = y.length;
    let scc = 0;
    let scx = 0;
    let sxx = 0;
    let scy = 0;
    let sxy = 0;

    for (let index = 0; index < n; index += 1) {
      scc += c[index] * c[index];
      scx += c[index] * x[index];
      sxx += x[index] * x[index];
      scy += c[index] * y[index];
      sxy += x[index] * y[index];
    }

    const det = (scc * sxx) - (scx * scx);
    const alpha = ((scy * sxx) - (sxy * scx)) / det;
    const beta = ((sxy * scc) - (scy * scx)) / det;
    const resid: number[] = [];

    for (let index = 0; index < n; index += 1) {
      resid.push(y[index] - ((alpha * c[index]) + (beta * x[index])));
    }

    const df = n - 2;
    const sse = resid.reduce((acc, value) => acc + (value * value), 0);
    const s2 = sse / df;
    const inv11 = scc / det;
    const seBeta = Math.sqrt(s2 * inv11);
    return { alpha, beta, resid, df, seBeta };
  },
  estimateRho(resid: number[]): number {
    let num = 0;
    let den = 0;

    for (let index = 1; index < resid.length; index += 1) {
      num += resid[index] * resid[index - 1];
      den += resid[index - 1] * resid[index - 1];
    }

    if (den === 0) return 0;
    return Math.max(-0.99, Math.min(0.99, num / den));
  },
  praisWinsten(years: number[], values: number[]): PraisWinstenResult {
    const n = years.length;
    const y = values.map((value) => Math.log10(value));
    const x = years.slice();
    const c = new Array<number>(n).fill(1);
    let fit = statsEngine.olsTransformed(c, x, y);
    let rho = statsEngine.estimateRho(fit.resid);
    let prev: number | null = null;

    for (let iter = 0; iter < 100; iter += 1) {
      const cT = [Math.sqrt(1 - (rho * rho))];
      const xT = [cT[0] * x[0]];
      const yT = [cT[0] * y[0]];

      for (let index = 1; index < n; index += 1) {
        cT.push(1 - rho);
        xT.push(x[index] - (rho * x[index - 1]));
        yT.push(y[index] - (rho * y[index - 1]));
      }

      fit = statsEngine.olsTransformed(cT, xT, yT);
      const residOriginal = years.map((year, index) => y[index] - (fit.alpha + (fit.beta * year)));
      const newRho = statsEngine.estimateRho(residOriginal);
      if (prev !== null && Math.abs(newRho - prev) < 1e-8) {
        rho = newRho;
        break;
      }
      prev = rho;
      rho = newRho;
    }

    const beta = fit.beta;
    const df = n - 2;
    const t = beta / fit.seBeta;
    const p = 2 * (1 - statsEngine.tcdf(Math.abs(t), df));
    const tcrit = statsEngine.tInv(0.975, df);
    const ciBeta: [number, number] = [beta - (tcrit * fit.seBeta), beta + (tcrit * fit.seBeta)];
    const apc = (Math.pow(10, beta) - 1) * 100;
    const ciApc: [number, number] = [(Math.pow(10, ciBeta[0]) - 1) * 100, (Math.pow(10, ciBeta[1]) - 1) * 100];
    let classification: PraisWinstenResult['classification'] = 'estacionária';
    if (ciApc[0] > 0) classification = 'crescente';
    else if (ciApc[1] < 0) classification = 'decrescente';

    return { n, rho, alpha: fit.alpha, beta, seBeta: fit.seBeta, p, df, t, ciBeta, apc, ciApc, classification };
  },
};

/**
 * Client-side GLM fits (Poisson, Negative Binomial, Logistic) via IRLS.
 * Validates against golden JSON at display precision (Phase 3 Wave 0).
 */
import jStat from 'jstat';
import { Matrix, QrDecomposition, solve } from 'ml-matrix';

const MAX_IRLS_ITERATIONS = 50;
const MAX_THETA_ITERATIONS = 15;
const CONVERGENCE_TOLERANCE = 1e-7;
const MAX_DESIGN_COLUMNS = 32;

export interface GlmCoefficient {
  term: string;
  beta: number;
  se: number;
  z: number;
  p: number;
}

export interface GlmFitResult {
  coefficients: GlmCoefficient[];
  deviance: number;
  dfResid: number;
  pearsonChi2: number;
  converged: boolean;
  iterations: number;
}

export interface NegativeBinomialFitResult extends GlmFitResult {
  theta: number;
}

export interface LogisticFitResult extends GlmFitResult {
  oddsRatios: Array<{ term: string; or: number; ci95: [number, number] }>;
}

export interface GlmDesign {
  terms: string[];
  matrix: number[][];
}

function assertDesign(y: number[], design: GlmDesign): void {
  if (!y.length) throw new Error('Resposta vazia.');
  if (design.matrix.length !== y.length) {
    throw new Error('Design matrix com número de linhas diferente da resposta.');
  }
  if (design.terms.length !== design.matrix[0]?.length) {
    throw new Error('Número de termos difere das colunas do design.');
  }
  if (design.terms.length > MAX_DESIGN_COLUMNS) {
    throw new Error(`Design matrix excede ${MAX_DESIGN_COLUMNS} colunas.`);
  }
}

function accumulateXtWX(X: Matrix, weights: number[]): Matrix {
  const p = X.columns;
  const XtWX = Matrix.zeros(p, p);
  for (let row = 0; row < X.rows; row += 1) {
    const w = weights[row];
    for (let j = 0; j < p; j += 1) {
      for (let k = j; k < p; k += 1) {
        const value = XtWX.get(j, k) + (w * X.get(row, j) * X.get(row, k));
        XtWX.set(j, k, value);
        if (j !== k) XtWX.set(k, j, value);
      }
    }
  }
  return XtWX;
}

function accumulateXtWz(X: Matrix, weights: number[], z: number[]): number[] {
  const p = X.columns;
  const vector = new Array<number>(p).fill(0);
  for (let row = 0; row < X.rows; row += 1) {
    const w = weights[row];
    for (let j = 0; j < p; j += 1) {
      vector[j] += w * X.get(row, j) * z[row];
    }
  }
  return vector;
}

function solveWeightedLeastSquares(X: Matrix, weights: number[], z: number[]): number[] {
  const XtWX = accumulateXtWX(X, weights);
  const XtWz = accumulateXtWz(X, weights, z);
  return solve(XtWX, Matrix.columnVector(XtWz), true).to1DArray();
}

function buildCoefficientStats(
  terms: string[],
  beta: number[],
  X: Matrix,
  weights: number[],
): GlmCoefficient[] {
  const sqrtW = weights.map((weight) => Math.sqrt(Math.max(weight, 1e-12)));
  const weightedX = X.clone();
  for (let row = 0; row < X.rows; row += 1) {
    for (let column = 0; column < X.columns; column += 1) {
      weightedX.set(row, column, X.get(row, column) * sqrtW[row]);
    }
  }

  let cov: Matrix;
  try {
    const qr = new QrDecomposition(weightedX);
    const R = qr.upperTriangularMatrix;
    const p = terms.length;
    cov = Matrix.zeros(p, p);
    for (let i = p - 1; i >= 0; i -= 1) {
      cov.set(i, i, 1 / (R.get(i, i) * R.get(i, i)));
      for (let j = i + 1; j < p; j += 1) {
        let sum = 0;
        for (let k = i; k < j; k += 1) {
          sum += R.get(i, k) * cov.get(k, j);
        }
        cov.set(i, j, -sum / R.get(i, i));
      }
    }
    for (let i = 0; i < p; i += 1) {
      for (let j = 0; j < i; j += 1) {
        cov.set(i, j, cov.get(j, i));
      }
    }
  } catch {
    cov = Matrix.zeros(terms.length, terms.length);
  }

  return terms.map((term, index) => {
    const se = Math.sqrt(Math.max(cov.get(index, index), 0));
    const z = se > 0 ? beta[index] / se : 0;
    const pValue = 2 * (1 - jStat.normal.cdf(Math.abs(z), 0, 1));
    return { term, beta: beta[index], se, z, p: pValue };
  });
}

interface IrlsOptions {
  family: 'poisson' | 'binomial' | 'negbin';
  y: number[];
  design: GlmDesign;
  theta?: number;
}

function runIrls({ family, y, design, theta = 1 }: IrlsOptions): GlmFitResult & { mu: number[] } {
  assertDesign(y, design);
  const n = y.length;
  const p = design.terms.length;
  const X = new Matrix(design.matrix);
  let beta = new Array<number>(p).fill(0);
  let mu = y.map((value) => {
    if (family === 'binomial') return Math.min(0.95, Math.max(0.05, value === 1 ? 0.75 : 0.25));
    return Math.max(value, 0.5);
  });
  let converged = false;
  let iterations = 0;

  for (iterations = 0; iterations < MAX_IRLS_ITERATIONS; iterations += 1) {
    const eta = mu.map((value) => (family === 'binomial'
      ? Math.log(value / (1 - value))
      : Math.log(Math.max(value, 1e-12))));
    const variance = mu.map((value) => {
      if (family === 'binomial') return Math.max(value * (1 - value), 1e-8);
      if (family === 'negbin') return value + ((value ** 2) / Math.max(theta, 1e-6));
      return Math.max(value, 1e-12);
    });
    const weights = mu.map((value, index) => {
      const v = variance[index];
      if (family === 'binomial') return v;
      const dEtaDmu = 1 / Math.max(value, 1e-12);
      return 1 / (v * dEtaDmu * dEtaDmu);
    });
    const z = eta.map((value, index) => {
      const muValue = mu[index];
      const detaDmu = family === 'binomial'
        ? 1 / Math.max(muValue * (1 - muValue), 1e-8)
        : 1 / Math.max(muValue, 1e-12);
      return value + ((y[index] - muValue) * detaDmu);
    });

    const nextBeta = solveWeightedLeastSquares(X, weights, z);
    const maxDelta = nextBeta.reduce((max, value, index) => Math.max(max, Math.abs(value - beta[index])), 0);
    beta = nextBeta;
    mu = design.matrix.map((row) => {
      const linear = row.reduce((sum, xij, j) => sum + (xij * beta[j]), 0);
      if (family === 'binomial') {
        const expEta = Math.exp(linear);
        return expEta / (1 + expEta);
      }
      return Math.exp(linear);
    });

    if (maxDelta < CONVERGENCE_TOLERANCE) {
      converged = true;
      break;
    }
  }

  const varianceFinal = mu.map((value) => {
    if (family === 'binomial') return Math.max(value * (1 - value), 1e-8);
    if (family === 'negbin') return value + ((value ** 2) / Math.max(theta, 1e-6));
    return Math.max(value, 1e-12);
  });
  const pearsonChi2 = y.reduce((sum, yi, index) => {
    const v = varianceFinal[index];
    return sum + ((yi - mu[index]) ** 2) / v;
  }, 0);
  const deviance = y.reduce((sum, yi, index) => {
    const muValue = Math.max(mu[index], 1e-12);
    if (family === 'binomial') {
      if (yi === 0) return sum + 2 * Math.log(1 / (1 - muValue));
      if (yi === 1) return sum + 2 * Math.log(1 / muValue);
      return sum;
    }
    if (yi === 0) return sum + 2 * muValue;
    return sum + 2 * (yi * Math.log(yi / muValue) - (yi - muValue));
  }, 0);
  const dfResid = Math.max(n - p, 0);
  const weightsFinal = mu.map((value, index) => {
    const v = varianceFinal[index];
    if (family === 'binomial') return v;
    const dEtaDmu = 1 / Math.max(value, 1e-12);
    return 1 / (v * dEtaDmu * dEtaDmu);
  });
  const coefficients = buildCoefficientStats(design.terms, beta, X, weightsFinal);

  return {
    coefficients,
    deviance,
    dfResid,
    pearsonChi2,
    converged,
    iterations: iterations + 1,
    mu,
  };
}

export function fitPoisson(y: number[], design: GlmDesign): GlmFitResult {
  const { mu, ...result } = runIrls({ family: 'poisson', y, design });
  void mu;
  return result;
}

export function fitNegativeBinomial(y: number[], design: GlmDesign): NegativeBinomialFitResult {
  const poisson = runIrls({ family: 'poisson', y, design });
  let theta = poisson.dfResid > 0 ? Math.max((poisson.pearsonChi2 / poisson.dfResid) - 1, 0.01) : 1;
  let fit = runIrls({ family: 'negbin', y, design, theta });
  let converged = fit.converged;

  for (let outer = 0; outer < MAX_THETA_ITERATIONS; outer += 1) {
    const nextTheta = fit.dfResid > 0
      ? Math.max((fit.pearsonChi2 / fit.dfResid), 0.01)
      : theta;
    if (Math.abs(nextTheta - theta) < CONVERGENCE_TOLERANCE) {
      converged = fit.converged;
      break;
    }
    theta = nextTheta;
    fit = runIrls({ family: 'negbin', y, design, theta });
  }

  return { ...fit, theta, converged };
}

export function fitLogistic(y: number[], design: GlmDesign): LogisticFitResult {
  const normalizedY = y.map((value) => (value > 0.5 ? 1 : 0));
  const fit = runIrls({ family: 'binomial', y: normalizedY, design });
  const oddsRatios = fit.coefficients.map(({ term, beta, se }) => ({
    term,
    or: Math.exp(beta),
    ci95: [Math.exp(beta - 1.96 * se), Math.exp(beta + 1.96 * se)] as [number, number],
  }));
  return { ...fit, oddsRatios };
}

/** Build intercept + treatment dummy columns (contr.treatment) for a numeric + optional categorical predictor. */
export function buildTreatmentDesign(
  rows: Array<{ outcome: number; numeric?: number; category?: string }>,
  categoryLevels?: string[],
): GlmDesign {
  const levels = categoryLevels ?? [...new Set(rows.map((row) => row.category).filter(Boolean) as string[])].sort();
  const hasNumeric = rows.some((row) => row.numeric !== undefined && Number.isFinite(row.numeric));
  const hasCategory = levels.length > 0;
  const terms = ['(Intercept)'];
  if (hasNumeric) terms.push('x');
  if (hasCategory && levels.length > 1) {
    levels.slice(1).forEach((level) => terms.push(String(level)));
  }

  const matrix = rows.map((row) => {
    const vector = [1];
    if (hasNumeric) vector.push(row.numeric ?? 0);
    if (hasCategory && levels.length > 1) {
      levels.slice(1).forEach((level) => vector.push(row.category === level ? 1 : 0));
    }
    return vector;
  });

  return { terms, matrix };
}

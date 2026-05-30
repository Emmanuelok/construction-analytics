/* ML dataset-readiness analytics — pure, unit-tested. Turns a dataset's
 * training attributes (volume, label completeness, class balance, train/val/test
 * split, inter-annotator agreement, duplicate rate, anonymization) into the
 * numbers an ML engineer gates on: effective example counts, split validity, a
 * class-imbalance ratio, six component scores, a composite readiness score with
 * a grade, a ready-to-train gate and a diagnostic warning list. The analytical
 * core of an operable AI Training Studio. */

export type MLDataset = {
  id: string
  name: string
  task: string
  modality: string
  examples: number // total labeled examples
  labelCompleteness: number // % of examples with complete labels
  numClasses: number // number of label classes (1 = regression/LLM)
  majorityClassPct: number // % of examples in the largest class
  trainPct: number
  valPct: number
  testPct: number
  annotatorAgreement: number // 0–1 inter-annotator agreement (κ)
  duplicateRate: number // % near-duplicate examples
  piiClean: boolean // anonymization complete
}

export type Severity = 'High' | 'Medium' | 'Low'
export type Warning = { code: string; severity: Severity; message: string }
export type Grade = 'A' | 'B' | 'C' | 'D'

export type ComponentScores = { completeness: number; balance: number; agreement: number; cleanliness: number; volume: number; split: number }

export type Readiness = MLDataset & {
  effectiveExamples: number // usable labeled, deduped
  trainCount: number
  valCount: number
  testCount: number
  splitSum: number
  splitValid: boolean
  imbalanceRatio: number // majority share ÷ uniform share (1 = balanced)
  minorityCount: number // examples in an average minority class
  scores: ComponentScores
  readiness: number // 0–100
  grade: Grade
  readyToTrain: boolean
  warnings: Warning[]
}

export type ReadinessOpts = { minReadiness: number; minPerClass: number; minCompleteness: number }
export const DEFAULT_OPTS: ReadinessOpts = { minReadiness: 75, minPerClass: 50, minCompleteness: 95 }

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n))
const round = Math.round
const round2 = (n: number) => Math.round(n * 100) / 100

const WEIGHTS: ComponentScores = { completeness: 0.25, balance: 0.2, agreement: 0.2, cleanliness: 0.15, volume: 0.1, split: 0.1 }

function gradeFor(r: number): Grade {
  if (r >= 85) return 'A'
  if (r >= 70) return 'B'
  if (r >= 55) return 'C'
  return 'D'
}

/** Compute the full readiness picture for one dataset. */
export function computeReadiness(d: MLDataset, opts: ReadinessOpts = DEFAULT_OPTS): Readiness {
  const examples = Math.max(0, d.examples)
  const dup = clamp(d.duplicateRate)
  const completenessPct = clamp(d.labelCompleteness)
  const effectiveExamples = round(examples * (1 - dup / 100) * (completenessPct / 100))

  const splitSum = round2(d.trainPct + d.valPct + d.testPct)
  const splitValid = splitSum === 100
  const trainCount = round(effectiveExamples * d.trainPct / 100)
  const valCount = round(effectiveExamples * d.valPct / 100)
  const testCount = round(effectiveExamples * d.testPct / 100)

  const classes = Math.max(1, Math.round(d.numClasses))
  const uniform = 100 / classes
  const imbalanceRatio = round2(clamp(d.majorityClassPct, 0, 100) / uniform)
  const minorityShare = classes > 1 ? (100 - clamp(d.majorityClassPct, 0, 100)) / (classes - 1) : 100
  const minorityCount = round(effectiveExamples * minorityShare / 100)

  const scores: ComponentScores = {
    completeness: clamp(completenessPct),
    balance: clamp(100 - Math.max(0, imbalanceRatio - 1) * 40),
    agreement: clamp(d.annotatorAgreement * 100),
    cleanliness: clamp(100 - dup * 2),
    volume: clamp((Math.log10(Math.max(1, examples)) / 5) * 100),
    split: splitValid ? 100 : clamp(100 - Math.abs(100 - splitSum) * 5),
  }
  const readiness = round(
    scores.completeness * WEIGHTS.completeness +
    scores.balance * WEIGHTS.balance +
    scores.agreement * WEIGHTS.agreement +
    scores.cleanliness * WEIGHTS.cleanliness +
    scores.volume * WEIGHTS.volume +
    scores.split * WEIGHTS.split,
  )

  const warnings: Warning[] = []
  if (!splitValid) warnings.push({ code: 'split', severity: 'High', message: `Train/val/test split must sum to 100% (currently ${splitSum}%)` })
  if (!d.piiClean) warnings.push({ code: 'pii', severity: 'High', message: 'Not anonymized — PII must be removed before training or licensing' })
  if (imbalanceRatio > 2) warnings.push({ code: 'imbalance', severity: 'Medium', message: `Class imbalance: majority class is ${imbalanceRatio}× over-represented` })
  if (d.annotatorAgreement < 0.7) warnings.push({ code: 'agreement', severity: 'Medium', message: `Low inter-annotator agreement (κ=${round2(d.annotatorAgreement)})` })
  if (completenessPct < opts.minCompleteness) warnings.push({ code: 'labels', severity: 'Medium', message: `Labels incomplete (${completenessPct}% labeled)` })
  if (classes > 1 && minorityCount < opts.minPerClass) warnings.push({ code: 'minority', severity: 'Medium', message: `Minority class has only ~${minorityCount} examples (< ${opts.minPerClass})` })
  if (dup > 10) warnings.push({ code: 'dups', severity: 'Low', message: `High duplicate rate (${dup}%)` })
  if (scores.volume < 60) warnings.push({ code: 'volume', severity: 'Low', message: `Small dataset (${examples.toLocaleString()} examples)` })

  const readyToTrain =
    readiness >= opts.minReadiness &&
    splitValid &&
    d.piiClean &&
    completenessPct >= opts.minCompleteness &&
    (classes === 1 || minorityCount >= opts.minPerClass)

  return {
    ...d,
    effectiveExamples,
    trainCount,
    valCount,
    testCount,
    splitSum,
    splitValid,
    imbalanceRatio,
    minorityCount,
    scores,
    readiness,
    grade: gradeFor(readiness),
    readyToTrain,
    warnings,
  }
}

export type StudioSummary = {
  count: number
  avgReadiness: number
  ready: number
  totalExamples: number
  totalEffective: number
  withWarnings: number
}

export function summarize(datasets: MLDataset[], opts: ReadinessOpts = DEFAULT_OPTS): StudioSummary {
  const scored = datasets.map((d) => computeReadiness(d, opts))
  if (!scored.length) return { count: 0, avgReadiness: 0, ready: 0, totalExamples: 0, totalEffective: 0, withWarnings: 0 }
  return {
    count: scored.length,
    avgReadiness: round(scored.reduce((s, r) => s + r.readiness, 0) / scored.length),
    ready: scored.filter((r) => r.readyToTrain).length,
    totalExamples: scored.reduce((s, r) => s + Math.max(0, r.examples), 0),
    totalEffective: scored.reduce((s, r) => s + r.effectiveExamples, 0),
    withWarnings: scored.filter((r) => r.warnings.length > 0).length,
  }
}

export function readinessNarrative(s: StudioSummary): string {
  return `${s.ready} of ${s.count} datasets are ready to train, averaging ${s.avgReadiness}/100 readiness. Of ${s.totalExamples.toLocaleString()} labeled examples, ${s.totalEffective.toLocaleString()} are usable after de-duplication and incomplete-label removal. ${s.withWarnings} dataset${s.withWarnings === 1 ? '' : 's'} still carry blocking or quality warnings.`
}

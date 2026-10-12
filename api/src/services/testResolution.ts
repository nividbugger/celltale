import type { PackageDoc, ResolvedTest, TestDoc } from '../types'

/**
 * Resolves the working test-selection state (packageIds + manualTestIds) into a snapshotted
 * list of tests. This is called once, at `confirm()` — the snapshot (name/sampleType/cost) is
 * what every downstream step (sample generation, billing) reads from then on, so editing or
 * deleting the underlying Test afterward can never change what a historical appointment means.
 *
 * Pure function: same inputs always produce the same output, so it's safe to call again during
 * migration backfill without any live-traffic side effects.
 */
export function resolveTests(
  packageIds: string[],
  manualTestIds: string[],
  packages: PackageDoc[],
  tests: TestDoc[],
): ResolvedTest[] {
  const testsById = new Map(tests.map((t) => [t.id, t]))
  const packagesById = new Map(packages.map((p) => [p.id, p]))

  const seen = new Map<string, ResolvedTest>()

  for (const packageId of packageIds) {
    const pkg = packagesById.get(packageId)
    if (!pkg) continue
    // testIds is technically required on PackageDoc, but real package documents created
    // before a test list was ever configured on them (or edited by hand) can genuinely be
    // missing it — treat that as "bundles nothing" rather than crashing appointment confirm.
    for (const testId of pkg.testIds ?? []) {
      if (seen.has(testId)) continue
      const snapshot = snapshotTest(testId, testsById, 'package', packageId)
      if (snapshot) seen.set(testId, snapshot)
    }
  }

  for (const testId of manualTestIds) {
    if (seen.has(testId)) continue
    const snapshot = snapshotTest(testId, testsById, 'manual')
    if (snapshot) seen.set(testId, snapshot)
  }

  return Array.from(seen.values())
}

function snapshotTest(
  testId: string,
  testsById: Map<string, TestDoc>,
  origin: 'package' | 'manual',
  sourcePackageId?: string,
): ResolvedTest | null {
  const test = testsById.get(testId)
  if (!test) return null
  return {
    testId,
    name: test.name,
    // Tests created before this refactor may not have a sampleType yet — the migration
    // backfills 'other', but this fallback keeps generate-samples from ever throwing on a
    // data-quality gap even if a test somehow slips through un-backfilled.
    sampleType: test.sampleType ?? 'other',
    cost: test.cost ?? 0,
    origin,
    ...(sourcePackageId ? { sourcePackageId } : {}),
  }
}

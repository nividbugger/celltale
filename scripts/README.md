# LIMS migration scripts

One-off, manually-run scripts for the Patient → Appointment → Tests → Samples → Barcode →
Reports refactor (see `docs/lims-architecture-refactor.md`). Not deployed as a Cloud Function —
run once, by hand, during the agreed maintenance window.

## Rollout runbook

Downtime for this window has been agreed in advance; steps are sequential, not dual-write.

1. **Back up production Firestore** before touching anything:
   ```
   gcloud firestore export gs://<your-backup-bucket>/lims-migration-$(date +%Y%m%d) --project <project-id>
   ```
2. **Take the site down** (maintenance page / disable hosting) so no new appointments are
   created mid-migration.
3. **Deploy code** — Firestore rules, indexes, the new `tests.sampleType` field, the new
   `appointments`/`samples`/`invoices` fields, the rewritten Cloud Function triggers, and the
   new frontend, all together:
   ```
   firebase deploy --only firestore:rules,firestore:indexes,functions,hosting
   ```
   Rules/indexes must land before the backfill runs, and the trigger rewrite must land in the
   same deploy — see `docs/lims-architecture-refactor.md` §15 for why that specific ordering
   constraint exists (a status-email trigger silently stops firing otherwise).
4. **Dry run** the backfill against production and eyeball the output — no writes happen:
   ```
   cd scripts && npm install
   npx ts-node migrate-lims.ts --project <project-id> --dry-run
   ```
5. **Run it for real**:
   ```
   npx ts-node migrate-lims.ts --project <project-id>
   ```
6. **Spot-check** a handful of migrated appointments across each legacy status value (`Pending`,
   `Confirmed`, `Sample Collected`, `Report Ready`, `Completed`, `Cancelled`) directly in the
   Firestore console — confirm `resolvedTests`/`sampleIds`/`status` look sane. Triage every ID
   the script printed under "MANUAL REVIEW REQUIRED" (appointments whose test list couldn't be
   derived, usually because the source package was deleted).
7. **Tighten `firestore.rules`** — the `appointments` collection's old patient-self-`create`
   path is already removed as part of step 3's deploy; nothing further needed here, but confirm
   it took effect (a stray client-side write attempt should now fail).
8. **Smoke test the new live path** end to end before reopening: create a walk-in appointment,
   add a package + a manual test, confirm, generate samples, print a label, collect a sample,
   generate a report, mark complete.
9. **Reopen the site.**

## Testing against the emulator first

Before running any of this against production, rehearse it against the Firestore emulator:

```
firebase emulators:start --only firestore,auth
# in another terminal, with the emulator running:
FIRESTORE_EMULATOR_HOST=localhost:8080 npx ts-node migrate-lims.ts --project demo-test --dry-run
FIRESTORE_EMULATOR_HOST=localhost:8080 npx ts-node migrate-lims.ts --project demo-test
```

Seed the emulator with a few synthetic legacy-shaped appointments (one per old status value,
plus one with no `packageId` at all) before running, so the dry-run output and the
manual-review list are actually exercised rather than trivially empty.

## Re-running

The script is idempotent — `packages` being present on an appointment doc means it's already
migrated, and it's skipped. Placeholder sample IDs are deterministic
(`S-LEGACY-{appointmentId}`), so even a script crash mid-run never produces duplicate or
orphaned samples on a re-run.

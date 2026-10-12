/**
 * Seed the comprehensive test catalog to Firestore.
 * Idempotent: uses setDoc with stable IDs from catalog/tests.js.
 *
 * Emulator (default):
 *   node seed-catalog.js
 *
 * Production:
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json node seed-catalog.js
 */

'use strict'

const { CATALOG } = require('./catalog/tests')

const isProd = Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS) && !process.env.FIRESTORE_EMULATOR_HOST

if (!isProd) {
  process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080'
  console.log(`Target: LOCAL EMULATOR (${process.env.FIRESTORE_EMULATOR_HOST})`)
} else {
  console.log('Target: PRODUCTION Firestore')
  console.log(`Credentials: ${process.env.GOOGLE_APPLICATION_CREDENTIALS}`)
}

const admin = require('firebase-admin')
const { Timestamp } = require('firebase-admin/firestore')

const PROJECT_ID = 'celltalediagnostics-8f817'

if (!admin.apps.length) {
  admin.initializeApp(
    isProd
      ? { credential: admin.credential.applicationDefault(), projectId: PROJECT_ID }
      : { projectId: PROJECT_ID },
  )
}

const db = admin.firestore()

const BATCH_LIMIT = 500

async function seedCatalog() {
  console.log(`\nSeeding ${CATALOG.length} tests from catalog...\n`)

  const now = Timestamp.now()

  let batch = db.batch()
  let count = 0

  for (const entry of CATALOG) {
    const { id, ...fields } = entry

    const docData = {
      ...fields,
      createdAt: now,
      updatedAt: now,
    }

    batch.set(db.doc(`tests/${id}`), docData)
    console.log(`  tests/${id}  [${fields.machineCode}]  ${fields.name}`)

    count++
    if (count % BATCH_LIMIT === 0) {
      await batch.commit()
      console.log(`\n  committed ${count} so far...\n`)
      batch = db.batch()
    }
  }

  if (count % BATCH_LIMIT !== 0) {
    await batch.commit()
  }

  console.log(`\n✓ Seeded ${count} tests successfully.`)
  if (!isProd) {
    console.log('\nAll tests start with isActive=false.')
    console.log('Go to Admin → Tests to activate the tests your lab offers.\n')
  }
}

seedCatalog().catch((err) => {
  console.error('\n✗ Seed failed:', err)
  process.exit(1)
})

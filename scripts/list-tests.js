'use strict'
// Lists all tests + parameters from Firestore production so we can see exact names.
// Usage: node scripts/list-tests.js

const admin = require('firebase-admin')

admin.initializeApp({ projectId: 'celltalediagnostics-8f817' })
const db = admin.firestore()

async function main() {
  const snap = await db.collection('tests').get()
  console.log(`\n${snap.size} tests found\n`)
  for (const doc of snap.docs) {
    const d = doc.data()
    console.log(`[${doc.id}]  "${d.name}"  machineCode=${d.machineCode ?? '—'}  category=${d.category ?? '—'}`)
    for (const p of d.parameters ?? []) {
      console.log(`    parameter: "${p.parameter}"  unit: "${p.unit}"  machineCode: ${p.machineCode ?? '—'}`)
    }
  }
}

main().catch(e => { console.error(e); process.exit(1) })

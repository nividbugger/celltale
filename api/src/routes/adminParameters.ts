import { Router } from 'express'
import * as admin from 'firebase-admin'
import { FieldValue } from 'firebase-admin/firestore'
import { verifyAuth, AuthRequest } from '../middleware/verifyAuth'
import { requireAdmin } from '../middleware/requireAdmin'

const router = Router()

type Sex = 'ALL' | 'M' | 'F'

interface ParameterInput {
  code: string
  analyzer: string
  loinc?: string | null
  name: string
  discipline: string
  tubeColor: string
  additive?: string
  unit: string
  refLow?: number | null
  refHigh?: number | null
  sex: Sex
  refText?: string | null
}

function parseParameterInput(body: unknown): { data: ParameterInput } | { error: string } {
  const b = (body ?? {}) as Record<string, unknown>

  if (typeof b.code !== 'string' || !b.code.trim()) return { error: 'code is required' }
  if (typeof b.name !== 'string' || !b.name.trim()) return { error: 'name is required' }
  if (typeof b.discipline !== 'string' || !b.discipline.trim()) return { error: 'discipline is required' }
  if (typeof b.analyzer !== 'string' || !b.analyzer.trim()) return { error: 'analyzer is required' }
  if (typeof b.tubeColor !== 'string' || !b.tubeColor.trim()) return { error: 'tubeColor is required' }
  if (typeof b.unit !== 'string' || !b.unit.trim()) return { error: 'unit is required' }
  if (!['ALL', 'M', 'F'].includes(b.sex as string)) return { error: 'sex must be ALL, M, or F' }

  let refLow: number | null = null
  if (b.refLow !== undefined && b.refLow !== null && b.refLow !== '') {
    const n = Number(b.refLow)
    if (!Number.isFinite(n)) return { error: 'refLow must be a number' }
    refLow = n
  }

  let refHigh: number | null = null
  if (b.refHigh !== undefined && b.refHigh !== null && b.refHigh !== '') {
    const n = Number(b.refHigh)
    if (!Number.isFinite(n)) return { error: 'refHigh must be a number' }
    refHigh = n
  }

  return {
    data: {
      code: (b.code as string).trim().toUpperCase(),
      analyzer: (b.analyzer as string).trim().toLowerCase(),
      loinc: typeof b.loinc === 'string' && b.loinc.trim() ? b.loinc.trim() : null,
      name: (b.name as string).trim(),
      discipline: (b.discipline as string).trim(),
      tubeColor: (b.tubeColor as string).trim(),
      additive: typeof b.additive === 'string' ? b.additive.trim() : '',
      unit: (b.unit as string).trim(),
      refLow,
      refHigh,
      sex: b.sex as Sex,
      refText: typeof b.refText === 'string' && b.refText.trim() ? b.refText.trim() : null,
    },
  }
}

router.post('/', verifyAuth, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const parsed = parseParameterInput(req.body)
    if ('error' in parsed) return res.status(400).json({ error: parsed.error })

    const now = FieldValue.serverTimestamp()
    const docRef = await admin.firestore().collection('diagnosticParameters').add({
      ...parsed.data,
      createdAt: now,
      updatedAt: now,
    })

    return res.status(201).json({ id: docRef.id, ...parsed.data, createdAt: null, updatedAt: null })
  } catch (err) {
    console.error('Error creating parameter:', err)
    return res.status(500).json({ error: 'Failed to create parameter' })
  }
})

router.patch('/:id', verifyAuth, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params
    const parsed = parseParameterInput(req.body)
    if ('error' in parsed) return res.status(400).json({ error: parsed.error })

    const docRef = admin.firestore().collection('diagnosticParameters').doc(id)
    const existing = await docRef.get()
    if (!existing.exists) return res.status(404).json({ error: 'Parameter not found' })

    await docRef.update({ ...parsed.data, updatedAt: FieldValue.serverTimestamp() })

    return res.json({ id, ...parsed.data })
  } catch (err) {
    console.error('Error updating parameter:', err)
    return res.status(500).json({ error: 'Failed to update parameter' })
  }
})

router.delete('/:id', verifyAuth, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params
    await admin.firestore().collection('diagnosticParameters').doc(id).delete()
    return res.json({ success: true })
  } catch (err) {
    console.error('Error deleting parameter:', err)
    return res.status(500).json({ error: 'Failed to delete parameter' })
  }
})

export default router

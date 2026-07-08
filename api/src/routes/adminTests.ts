import { Router } from 'express'
import * as admin from 'firebase-admin'
import { verifyAuth, AuthRequest } from '../middleware/verifyAuth'
import { requireAdmin } from '../middleware/requireAdmin'

const router = Router()

interface TestParameter {
  parameter: string
  unit: string
  biologicalReference: string
}

interface TestInput {
  name: string
  parameters: TestParameter[]
}

function parseTestInput(body: unknown): { data: TestInput } | { error: string } {
  const { name, parameters } = (body ?? {}) as Record<string, unknown>

  if (typeof name !== 'string' || !name.trim()) {
    return { error: 'name is required' }
  }

  if (!Array.isArray(parameters) || parameters.length === 0) {
    return { error: 'at least one parameter is required' }
  }

  for (const param of parameters) {
    if (typeof param !== 'object' || param === null) {
      return { error: 'each parameter must be an object' }
    }
    const p = param as Record<string, unknown>
    if (typeof p.parameter !== 'string' || !p.parameter.trim()) {
      return { error: 'each parameter must have a parameter name' }
    }
    if (typeof p.unit !== 'string' || !p.unit.trim()) {
      return { error: 'each parameter must have a unit' }
    }
    if (typeof p.biologicalReference !== 'string' || !p.biologicalReference.trim()) {
      return { error: 'each parameter must have a biologicalReference' }
    }
  }

  return {
    data: {
      name: name.trim(),
      parameters: parameters.map((p: any) => ({
        parameter: p.parameter.trim(),
        unit: p.unit.trim(),
        biologicalReference: p.biologicalReference.trim(),
      })),
    },
  }
}

function generateTestId(): string {
  return `TEST-${Math.random().toString(36).slice(2, 10).toUpperCase()}`
}

router.post('/', verifyAuth, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const parsed = parseTestInput(req.body)
    if ('error' in parsed) {
      return res.status(400).json({ error: parsed.error })
    }

    const testId = generateTestId()
    const now = admin.firestore.FieldValue.serverTimestamp()
    const testData = {
      testId,
      name: parsed.data.name,
      parameters: parsed.data.parameters.map((p: any) => ({
        parameter: p.parameter || '',
        unit: p.unit || '',
        biologicalReference: p.biologicalReference || '',
      })),
      createdAt: now,
      updatedAt: now,
    }

    const docRef = await admin.firestore().collection('tests').add(testData)

    return res.status(201).json({
      id: docRef.id,
      ...testData,
      createdAt: null,
      updatedAt: null,
    })
  } catch (err) {
    console.error('Error creating test:', err)
    return res.status(500).json({ error: 'Failed to create test' })
  }
})

router.patch('/:testId', verifyAuth, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { testId } = req.params
    const parsed = parseTestInput(req.body)
    if ('error' in parsed) {
      return res.status(400).json({ error: parsed.error })
    }

    const now = admin.firestore.FieldValue.serverTimestamp()
    const updateData = {
      name: parsed.data.name,
      parameters: parsed.data.parameters.map((p: any) => ({
        parameter: p.parameter || '',
        unit: p.unit || '',
        biologicalReference: p.biologicalReference || '',
      })),
      updatedAt: now,
    }

    const docRef = admin.firestore().collection('tests').doc(testId)
    await docRef.update(updateData)

    const snap = await docRef.get()
    if (!snap.exists) {
      return res.status(404).json({ error: 'Test not found' })
    }

    return res.json({
      id: snap.id,
      ...snap.data(),
      createdAt: null,
      updatedAt: null,
    })
  } catch (err) {
    console.error('Error updating test:', err)
    return res.status(500).json({ error: 'Failed to update test' })
  }
})

router.delete('/:testId', verifyAuth, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { testId } = req.params
    await admin.firestore().collection('tests').doc(testId).delete()
    return res.json({ success: true })
  } catch (err) {
    console.error('Error deleting test:', err)
    return res.status(500).json({ error: 'Failed to delete test' })
  }
})

export default router

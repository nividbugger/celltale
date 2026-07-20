import { Router } from 'express'
import * as admin from 'firebase-admin'
import { FieldValue } from 'firebase-admin/firestore'
import { verifyAuth, AuthRequest } from '../middleware/verifyAuth'
import { requireAdmin } from '../middleware/requireAdmin'

const router = Router()

interface TestParameter {
  parameter: string
  unit: string
  biologicalReference: string
}

const VALID_TUBE_COLORS = ['Red', 'Lavender', 'Grey', 'Black', 'Blue', 'Green', 'Yellow'] as const

interface TestInput {
  name: string
  parameters: TestParameter[]
  cost?: number
  tubeColor?: string
  machineCode?: string
  category?: string
}

function parseTestInput(body: unknown): { data: TestInput } | { error: string } {
  const { name, parameters, cost, tubeColor, machineCode, category } = (body ?? {}) as Record<string, unknown>

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

  let parsedCost: number | undefined
  if (cost !== undefined && cost !== null && cost !== '') {
    if (typeof cost !== 'number' || !Number.isFinite(cost) || cost < 0) {
      return { error: 'cost must be a non-negative number' }
    }
    parsedCost = cost
  }

  let parsedTubeColor: string | undefined
  if (tubeColor !== undefined && tubeColor !== null && tubeColor !== '') {
    if (typeof tubeColor !== 'string' || !(VALID_TUBE_COLORS as readonly string[]).includes(tubeColor)) {
      return { error: `tubeColor must be one of: ${VALID_TUBE_COLORS.join(', ')}` }
    }
    parsedTubeColor = tubeColor
  }

  let parsedMachineCode: string | undefined
  if (machineCode !== undefined && machineCode !== null && machineCode !== '') {
    if (typeof machineCode !== 'string') return { error: 'machineCode must be a string' }
    parsedMachineCode = machineCode.trim()
  }

  let parsedCategory: string | undefined
  if (category !== undefined && category !== null && category !== '') {
    if (typeof category !== 'string') return { error: 'category must be a string' }
    parsedCategory = category.trim()
  }

  return {
    data: {
      name: name.trim(),
      parameters: parameters.map((p: any) => ({
        parameter: p.parameter.trim(),
        unit: p.unit.trim(),
        biologicalReference: p.biologicalReference.trim(),
      })),
      ...(parsedCost !== undefined ? { cost: parsedCost } : {}),
      ...(parsedTubeColor !== undefined ? { tubeColor: parsedTubeColor } : {}),
      ...(parsedMachineCode !== undefined ? { machineCode: parsedMachineCode } : {}),
      ...(parsedCategory !== undefined ? { category: parsedCategory } : {}),
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
    const now = FieldValue.serverTimestamp()
    const testData = {
      testId,
      name: parsed.data.name,
      parameters: parsed.data.parameters.map((p: any) => ({
        parameter: p.parameter || '',
        unit: p.unit || '',
        biologicalReference: p.biologicalReference || '',
      })),
      ...(parsed.data.cost !== undefined ? { cost: parsed.data.cost } : {}),
      ...(parsed.data.tubeColor !== undefined ? { tubeColor: parsed.data.tubeColor } : {}),
      ...(parsed.data.machineCode !== undefined ? { machineCode: parsed.data.machineCode } : {}),
      ...(parsed.data.category !== undefined ? { category: parsed.data.category } : {}),
      isActive: true,
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

    const now = FieldValue.serverTimestamp()
    const updateData = {
      name: parsed.data.name,
      parameters: parsed.data.parameters.map((p: any) => ({
        parameter: p.parameter || '',
        unit: p.unit || '',
        biologicalReference: p.biologicalReference || '',
      })),
      cost: parsed.data.cost !== undefined ? parsed.data.cost : FieldValue.delete(),
      tubeColor: parsed.data.tubeColor !== undefined ? parsed.data.tubeColor : FieldValue.delete(),
      machineCode: parsed.data.machineCode !== undefined ? parsed.data.machineCode : FieldValue.delete(),
      category: parsed.data.category !== undefined ? parsed.data.category : FieldValue.delete(),
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

router.patch('/:testId/active', verifyAuth, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { testId } = req.params
    const { isActive } = req.body as Record<string, unknown>
    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ error: 'isActive must be a boolean' })
    }

    const docRef = admin.firestore().collection('tests').doc(testId)
    await docRef.update({ isActive, updatedAt: FieldValue.serverTimestamp() })

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
    console.error('Error toggling test active status:', err)
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

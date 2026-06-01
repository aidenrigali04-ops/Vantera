'use server'

import type { ActionResult } from '@/lib/auth/types'
import { updateVertical } from '@/app/(admin)/admin/onboarding/actions'
import {
  getOperatingModel,
  type OperatingModelId,
} from '@/lib/onboarding/operating-models'
import { revalidatePath } from 'next/cache'

export async function saveOperatingModel(
  modelId: OperatingModelId,
): Promise<ActionResult<{ vertical: string }>> {
  const model = getOperatingModel(modelId)
  if (!model) {
    return { success: false, error: 'Invalid operating model' }
  }

  const result = await updateVertical('', model.vertical)
  if (!result.success) {
    return result
  }

  revalidatePath('/admin/dashboard')
  revalidatePath('/admin/clients')
  revalidatePath('/admin/pipeline')

  return { success: true, data: { vertical: model.vertical } }
}

import { aggregateOverview } from '../../../../src/public-opinion/overview.js'
import { createAsmxClient } from '../../../../src/public-opinion/asmx-client.js'
import { isPublicOpinionConfigured } from '../../../../src/public-opinion/config.js'

export const dynamic = 'force-dynamic'

export async function GET() {
  if (!isPublicOpinionConfigured()) {
    return Response.json({ configured: false })
  }
  const payload = await aggregateOverview(createAsmxClient())
  return Response.json(payload)
}

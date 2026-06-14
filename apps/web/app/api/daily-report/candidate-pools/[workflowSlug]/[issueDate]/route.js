import { getCandidatePool } from '../../../../../../lib/daily-report/candidate-pool/index.js'

export const runtime = 'nodejs'

export async function GET(_request, { params }) {
  const { workflowSlug, issueDate } = await params
  try {
    const pool = await getCandidatePool({ workflowSlug, issueDate })
    return Response.json({ pool })
  } catch (error) {
    const status =
      error?.code === 'unsupported_issue_date'
        ? 400
        : error?.code === 'candidate_pool_fixture_missing'
          ? 404
          : error?.code === 'invalid_issue_date' || error?.code === 'candidate_pool_invalid'
            ? 400
            : 500
    return Response.json({ error: error.message, code: error.code ?? 'unknown_error' }, { status })
  }
}
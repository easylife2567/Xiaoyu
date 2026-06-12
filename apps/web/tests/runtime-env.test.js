import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { loadRuntimeEnv } from '../src/runtime-env.js'

test('loads local environment values from the repository root', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'xiaoyu-env-'))
  const previousNodeEnv = process.env.NODE_ENV
  const previousValue = process.env.XIAOYU_ENV_TEST_VALUE
  process.env.NODE_ENV = 'development'

  try {
    await writeFile(path.join(tempRoot, '.env.local'), 'XIAOYU_ENV_TEST_VALUE=from-root\n')
    delete process.env.XIAOYU_ENV_TEST_VALUE

    loadRuntimeEnv(tempRoot)

    assert.equal(process.env.XIAOYU_ENV_TEST_VALUE, 'from-root')
  } finally {
    if (previousNodeEnv === undefined) {
      delete process.env.NODE_ENV
    } else {
      process.env.NODE_ENV = previousNodeEnv
    }
    if (previousValue === undefined) {
      delete process.env.XIAOYU_ENV_TEST_VALUE
    } else {
      process.env.XIAOYU_ENV_TEST_VALUE = previousValue
    }
    await rm(tempRoot, { recursive: true, force: true })
  }
})

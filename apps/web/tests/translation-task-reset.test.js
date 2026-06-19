/**
 * 翻译任务 reset(完全删除)能力测试 — add-translation-task-reset-affordance
 *
 * 测试策略:
 *   - 用 memory backend 直接通过 store.createTask 构造 task fixture(绕过 service
 *     端到端,不依赖 Python worker / 真实 xlsx 解析)
 *   - 验证 reset 在任意状态下都能清空 task,且对不存在的 taskId 幂等成功
 *   - 测试 DELETE API 路由的响应形状与 daily-report 保持一致
 */

import assert from 'node:assert/strict'
import { after, before, beforeEach, test } from 'node:test'
import { DELETE as deleteTaskRoute, GET as getTaskRoute } from '../app/api/translation-processing/tasks/[taskId]/route.js'
import { getTranslationTask, resetTranslationTask } from '../lib/translation-processing/service.js'
import {
  createAttempt,
  createTask,
  markAttemptFailed,
  markAttemptProcessing,
  resetTaskStoreForTests,
} from '../lib/translation-processing/store.js'

const FAKE_VALIDATION = {
  code: 'OK',
  sheets: [{ name: 'DFY官方', rows: 1, columns: 5 }],
  sourceRows: 1,
  warnings: [],
}

before(() => {
  process.env.XIAOYU_TRANSLATION_RUNTIME_REPOSITORY = 'memory'
})

after(() => {
  delete process.env.XIAOYU_TRANSLATION_RUNTIME_REPOSITORY
})

beforeEach(async () => {
  await resetTaskStoreForTests()
})

async function createTaskFixture() {
  return createTask({
    fileName: 'test.xlsx',
    sourceObjectKey: `tasks/${Math.random().toString(16).slice(2)}.xlsx`,
    sizeBytes: 1024,
    validation: FAKE_VALIDATION,
  })
}

test('service.resetTranslationTask 删除 ready 状态的任务', async () => {
  const task = await createTaskFixture()
  assert.equal((await getTranslationTask(task.id)).id, task.id)
  const result = await resetTranslationTask(task.id)
  assert.deepEqual(result, { ok: true })
  await assert.rejects(() => getTranslationTask(task.id), /Task not found/i)
})

test('service.resetTranslationTask 删除 processing 状态的任务(retry 不可达的卡死场景)', async () => {
  const task = await createTaskFixture()
  const taskWithAttempt = await createAttempt(task.id)
  const attempt = taskWithAttempt.attempts.at(-1)
  await markAttemptProcessing(task.id, attempt.id)
  // processing 状态下 retry 会拒绝,但 reset 必须能清掉
  const result = await resetTranslationTask(task.id)
  assert.deepEqual(result, { ok: true })
  await assert.rejects(() => getTranslationTask(task.id), /Task not found/i)
})

test('service.resetTranslationTask 删除 failed 状态的任务及其 attempt', async () => {
  const task = await createTaskFixture()
  const taskWithAttempt = await createAttempt(task.id)
  const attempt = taskWithAttempt.attempts.at(-1)
  await markAttemptFailed(task.id, attempt.id, { category: 'ai', message: 'mock' }, [])
  const result = await resetTranslationTask(task.id)
  assert.deepEqual(result, { ok: true })
  await assert.rejects(() => getTranslationTask(task.id), /Task not found/i)
})

test('service.resetTranslationTask 对不存在的 taskId 幂等返回 ok', async () => {
  const result = await resetTranslationTask('non-existent-task-id')
  assert.deepEqual(result, { ok: true })
})

test('DELETE /api/translation-processing/tasks/[taskId] 路由清空任务并返回 200 ok', async () => {
  const task = await createTaskFixture()
  const response = await deleteTaskRoute(new Request(`http://localhost/api/translation-processing/tasks/${task.id}`, { method: 'DELETE' }), {
    params: Promise.resolve({ taskId: task.id }),
  })
  assert.equal(response.status, 200)
  const body = await response.json()
  assert.deepEqual(body, { ok: true })

  // 确认 GET 后任务已不存在
  const getResp = await getTaskRoute(new Request(`http://localhost/api/translation-processing/tasks/${task.id}`), {
    params: Promise.resolve({ taskId: task.id }),
  })
  assert.equal(getResp.status, 404)
})

test('DELETE 路由对不存在的任务幂等返回 200(对齐 daily-report reset 语义)', async () => {
  const response = await deleteTaskRoute(new Request('http://localhost/api/translation-processing/tasks/non-existent', { method: 'DELETE' }), {
    params: Promise.resolve({ taskId: 'non-existent' }),
  })
  assert.equal(response.status, 200)
  const body = await response.json()
  assert.deepEqual(body, { ok: true })
})

test('reset 后可重新创建翻译任务,旧任务 ID 与新任务 ID 独立', async () => {
  const oldTask = await createTaskFixture()
  await resetTranslationTask(oldTask.id)
  const newTask = await createTaskFixture()
  assert.notEqual(newTask.id, oldTask.id)
  assert.equal(newTask.attempts.length, 0)
  assert.equal(newTask.artifacts.length, 0)
})

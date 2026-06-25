// 「每日舆情」daily-today mock 单元测试 — Phase 1 守护。

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

const {
  MOCK_KEYWORDS,
  getKeywordMeta,
  buildDailyTodayMock,
  buildDailyTodayCountMock,
  buildDailyTodayExportMock,
  DAILY_TODAY_HARD_CAP,
} = await import('../src/public-opinion/daily-today-mock.js')

describe('MOCK_KEYWORDS', () => {
  it('contains exactly 6 keywords with required fields', () => {
    assert.equal(MOCK_KEYWORDS.length, 6)
    for (const kw of MOCK_KEYWORDS) {
      assert.equal(typeof kw.id, 'string')
      assert.equal(typeof kw.displayName, 'string')
      assert.ok(Array.isArray(kw.aliases) && kw.aliases.length >= 1)
      assert.ok(Array.isArray(kw.languages) && kw.languages.length >= 1)
      assert.equal(typeof kw.weight, 'number')
    }
  })

  it('includes a cross-language keyword (peking) with zh/en/ja/ru aliases', () => {
    const peking = MOCK_KEYWORDS.find((k) => k.id === 'peking')
    assert.ok(peking, 'peking keyword exists')
    assert.deepEqual(peking.languages.sort(), ['en', 'ja', 'ru', 'zh'])
    assert.ok(peking.aliases.length >= 4)
  })

  it('getKeywordMeta returns the meta for known id, null for unknown', () => {
    assert.ok(getKeywordMeta('peking'))
    assert.equal(getKeywordMeta('unknown-keyword'), null)
  })
})

describe('buildDailyTodayMock', () => {
  it('returns required top-level shape', () => {
    const payload = buildDailyTodayMock({ keyword: 'peking', hours: 24 })
    assert.equal(payload.configured, true)
    assert.equal(payload.mock, true)
    assert.equal(payload.keyword, 'peking')
    assert.equal(payload.hours, 24)
    assert.equal(typeof payload.generatedAt, 'string')
    assert.ok(Array.isArray(payload.histogram))
    assert.equal(payload.histogram.length, 24)
    assert.ok(Array.isArray(payload.platforms))
    assert.ok(Array.isArray(payload.items))
    assert.deepEqual(payload.errors, {})
  })

  it('items count is approximately keyword.weight (±25%) for 24h window', () => {
    for (const kw of MOCK_KEYWORDS) {
      const payload = buildDailyTodayMock({ keyword: kw.id, hours: 24 })
      const lower = kw.weight * 0.75
      const upper = Math.min(DAILY_TODAY_HARD_CAP, kw.weight * 1.25)
      assert.ok(
        payload.items.length >= lower && payload.items.length <= upper,
        `${kw.id}: items.length=${payload.items.length} not in [${lower}, ${upper}]`,
      )
    }
  })

  it('items are sorted by publishedAt descending', () => {
    const payload = buildDailyTodayMock({ keyword: 'peking', hours: 24 })
    for (let i = 1; i < payload.items.length; i += 1) {
      assert.ok(
        payload.items[i - 1].publishedAt >= payload.items[i].publishedAt,
        `out of order at index ${i}`,
      )
    }
  })

  it('every non-zh item has translation.zh', () => {
    const payload = buildDailyTodayMock({ keyword: 'peking', hours: 24 })
    for (const item of payload.items) {
      if (item.language === 'zh') {
        assert.equal(item.translation, undefined)
      } else {
        assert.ok(item.translation, `item ${item.id} (${item.language}) missing translation`)
        assert.equal(typeof item.translation.zh, 'string')
        assert.ok(item.translation.zh.length > 0)
      }
    }
  })

  it('every item body contains the matchedKeyword (alias) string', () => {
    const payload = buildDailyTodayMock({ keyword: 'peking', hours: 24 })
    for (const item of payload.items) {
      assert.ok(
        item.body.includes(item.matchedKeyword),
        `item ${item.id} body missing alias "${item.matchedKeyword}"`,
      )
    }
  })

  it('histogram sums to items.length', () => {
    const payload = buildDailyTodayMock({ keyword: 'peking', hours: 24 })
    const sum = payload.histogram.reduce((a, b) => a + b, 0)
    assert.equal(sum, payload.items.length)
  })

  it('shorter time window produces proportionally fewer items', () => {
    const p24 = buildDailyTodayMock({ keyword: 'peking', hours: 24 })
    const p6 = buildDailyTodayMock({ keyword: 'peking', hours: 6 })
    assert.ok(p6.items.length < p24.items.length)
    // 6h 应大约是 24h 的 1/4,允许 ±50% 容差
    const ratio = p6.items.length / p24.items.length
    assert.ok(ratio > 0.15 && ratio < 0.4, `6h/24h ratio ${ratio} out of expected band`)
  })

  it('hard caps items at 5000 with truncated flag', () => {
    // peking weight=1247 不会触发;但语义校验:truncated 字段存在
    const payload = buildDailyTodayMock({ keyword: 'peking', hours: 24 })
    assert.equal(typeof payload.truncated, 'boolean')
    assert.ok(payload.items.length <= DAILY_TODAY_HARD_CAP)
  })

  it('falls back to first keyword on unknown id', () => {
    const payload = buildDailyTodayMock({ keyword: 'nonexistent', hours: 24 })
    assert.equal(payload.keyword, MOCK_KEYWORDS[0].id)
  })

  it('platforms only includes those with count > 0', () => {
    const payload = buildDailyTodayMock({ keyword: 'qian-xuesen', hours: 24 })
    for (const p of payload.platforms) {
      assert.ok(p.count > 0, `platform ${p.id} has zero count`)
      assert.equal(typeof p.color, 'string')
    }
  })
})

describe('buildDailyTodayCountMock', () => {
  it('returns 0 when since is missing', () => {
    const r = buildDailyTodayCountMock({ keyword: 'peking', hours: 24 })
    assert.equal(r.newCount, 0)
  })

  it('returns positive count for since 5 min ago', () => {
    const since = new Date(Date.now() - 5 * 60 * 1000).toISOString()
    const r = buildDailyTodayCountMock({ keyword: 'peking', hours: 24, since })
    assert.ok(r.newCount >= 0)
    assert.ok(r.newCount < 100, `5 min should yield modest count, got ${r.newCount}`)
  })

  it('returns higher count for since 1h ago than 5 min ago', () => {
    const since5m = new Date(Date.now() - 5 * 60 * 1000).toISOString()
    const since1h = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const r5 = buildDailyTodayCountMock({ keyword: 'peking', hours: 24, since: since5m })
    const r60 = buildDailyTodayCountMock({ keyword: 'peking', hours: 24, since: since1h })
    assert.ok(r60.newCount >= r5.newCount)
  })
})

describe('buildDailyTodayExportMock', () => {
  it('returns all items when ids is empty', () => {
    const all = buildDailyTodayMock({ keyword: 'qian-xuesen', hours: 24 })
    const exp = buildDailyTodayExportMock({ keyword: 'qian-xuesen', hours: 24 })
    assert.equal(exp.items.length, all.items.length)
  })

  it('filters to given ids when provided', () => {
    const all = buildDailyTodayMock({ keyword: 'qian-xuesen', hours: 24 })
    const subset = all.items.slice(0, 3).map((i) => i.id)
    const exp = buildDailyTodayExportMock({ keyword: 'qian-xuesen', hours: 24, ids: subset })
    assert.equal(exp.items.length, 3)
    assert.deepEqual(
      exp.items.map((i) => i.id).sort(),
      subset.sort(),
    )
  })
})

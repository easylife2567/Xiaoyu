import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// ---------------------------------------------------------------------------
// Mock payload module — Task 1: Mock Payload Module (v2 DTO shape)
// ---------------------------------------------------------------------------

const MOCK_PAYLOAD = await import('../src/public-opinion/mock-payload.js').then(
  (m) => m.MOCK_PAYLOAD,
);

describe('MOCK_PAYLOAD (v2 DTO shape)', () => {
  it('is an object with configured:true and mock:true', () => {
    assert.equal(typeof MOCK_PAYLOAD, 'object');
    assert.ok(MOCK_PAYLOAD !== null && !Array.isArray(MOCK_PAYLOAD));
    assert.equal(MOCK_PAYLOAD.configured, true);
    assert.equal(MOCK_PAYLOAD.mock, true);
  });

  it('has required top-level keys', () => {
    const required = [
      'kpis',
      'weeklyTrend',
      'todayHourly',
      'sentimentDistribution',
      'mediaShare',
      'todayPlatformShare',
      'mediaSentimentMatrix',
      'warnings',
      'topHotNews',
      'latestNews',
      'errors',
    ];
    for (const key of required) {
      assert.ok(Object.hasOwn(MOCK_PAYLOAD, key), `missing key "${key}"`);
    }
  });

  it('kpis shape: todayCount, weekCount, todayInfoCount', () => {
    const { kpis } = MOCK_PAYLOAD;
    assert.equal(typeof kpis.todayCount, 'number');
    assert.equal(typeof kpis.weekCount, 'number');
    assert.equal(typeof kpis.todayInfoCount, 'number');
    assert.ok(kpis.todayCount > 0);
    assert.ok(kpis.weekCount > 0);
    assert.ok(kpis.todayInfoCount > 0);
  });

  it('weeklyTrend has total + points[7] with label+count', () => {
    assert.equal(typeof MOCK_PAYLOAD.weeklyTrend.total, 'number');
    assert.equal(MOCK_PAYLOAD.weeklyTrend.points.length, 7);
    for (const pt of MOCK_PAYLOAD.weeklyTrend.points) {
      assert.equal(typeof pt.label, 'string');
      assert.equal(typeof pt.count, 'number');
    }
  });

  it('todayHourly has total + points[12]', () => {
    assert.equal(typeof MOCK_PAYLOAD.todayHourly.total, 'number');
    assert.equal(MOCK_PAYLOAD.todayHourly.points.length, 12);
  });

  it('sentimentDistribution has 5 entries', () => {
    assert.equal(MOCK_PAYLOAD.sentimentDistribution.length, 5);
    for (const e of MOCK_PAYLOAD.sentimentDistribution) {
      assert.equal(typeof e.label, 'string');
      assert.equal(typeof e.count, 'number');
    }
  });

  it('mediaShare has 6 entries with media+count+share', () => {
    assert.equal(MOCK_PAYLOAD.mediaShare.length, 6);
    for (const e of MOCK_PAYLOAD.mediaShare) {
      assert.equal(typeof e.media, 'string');
      assert.equal(typeof e.count, 'number');
      assert.equal(typeof e.share, 'number');
    }
  });

  it('todayPlatformShare has 6 entries', () => {
    assert.equal(MOCK_PAYLOAD.todayPlatformShare.length, 6);
  });

  it('mediaSentimentMatrix is 6×4 (media + 5 emotions)', () => {
    assert.equal(MOCK_PAYLOAD.mediaSentimentMatrix.length, 6);
    for (const row of MOCK_PAYLOAD.mediaSentimentMatrix) {
      assert.equal(typeof row.media, 'string');
      for (const label of ['正面', '偏正面', '中立', '偏负面', '负面']) {
        assert.equal(typeof row[label], 'number');
      }
    }
  });

  it('warnings shape: warningTotal, majorTotal, topWords[]', () => {
    const w = MOCK_PAYLOAD.warnings;
    assert.equal(typeof w.warningTotal, 'number');
    assert.equal(typeof w.majorTotal, 'number');
    assert.ok(Array.isArray(w.topWords));
    for (const tw of w.topWords) {
      assert.equal(typeof tw.word, 'string');
      assert.equal(typeof tw.count, 'number');
    }
  });

  it('topHotNews has 10 items with title+hotValue+emotion', () => {
    assert.equal(MOCK_PAYLOAD.topHotNews.length, 10);
    for (const item of MOCK_PAYLOAD.topHotNews) {
      assert.equal(typeof item.title, 'string');
      assert.equal(typeof item.hotValue, 'number');
      assert.equal(typeof item.emotion, 'string');
      assert.equal(typeof item.share, 'number');
    }
  });

  it('latestNews has 30 items with full fields + 4 risk items', () => {
    assert.equal(MOCK_PAYLOAD.latestNews.length, 30);
    const riskItems = MOCK_PAYLOAD.latestNews.filter((n) => n.risk);
    assert.equal(riskItems.length, 4);
    for (const item of MOCK_PAYLOAD.latestNews) {
      assert.equal(typeof item.title, 'string');
      assert.equal(typeof item.platform, 'string');
      assert.equal(typeof item.risk, 'boolean');
      assert.equal(typeof item.sentiment, 'string');
      assert.equal(typeof item.pubTime, 'string');
      assert.equal(typeof item.url, 'string');
    }
  });
});
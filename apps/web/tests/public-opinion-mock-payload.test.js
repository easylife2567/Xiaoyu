import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// ---------------------------------------------------------------------------
// Mock payload module — Task 1: Mock Payload Module
// ---------------------------------------------------------------------------
// These tests drive the creation of `mock-payload.js`.  All 6 must pass
// before moving on to Task 2.

const MOCK_PAYLOAD = await import('../src/public-opinion/mock-payload.js').then(
  (m) => m.MOCK_PAYLOAD,
);

describe('MOCK_PAYLOAD shape', () => {
  it('is an object', () => {
    assert.equal(typeof MOCK_PAYLOAD, 'object');
    assert.ok(MOCK_PAYLOAD !== null && !Array.isArray(MOCK_PAYLOAD));
  });

  it('has exactly 24 keys (24h)', () => {
    assert.equal(Object.keys(MOCK_PAYLOAD).length, 24);
  });

  it('each key is an ISO date-string hour (YYYY-MM-DDTHH:00:00Z)', () => {
    const isoHourRx = /^\d{4}-\d{2}-\d{2}T\d{2}:00:00Z$/;
    for (const key of Object.keys(MOCK_PAYLOAD)) {
      assert.match(key, isoHourRx, `key "${key}" is not an ISO hour`);
    }
  });

  it('every hour value is an array', () => {
    for (const [key, val] of Object.entries(MOCK_PAYLOAD)) {
      assert.ok(Array.isArray(val), `value for key "${key}" is not an array`);
    }
  });

  it('every item has the correct shape (text, score, source, timestamp)', () => {
    const requiredFields = ['text', 'score', 'source', 'timestamp'];
    for (const [key, items] of Object.entries(MOCK_PAYLOAD)) {
      for (const item of items) {
        for (const field of requiredFields) {
          assert.ok(
            Object.hasOwn(item, field),
            `item in key "${key}" missing field "${field}"`,
          );
        }
        const { text, score, source, timestamp } = item;
        assert.equal(typeof text, 'string');
        assert.equal(typeof score, 'number');
        assert.equal(typeof source, 'string');
        assert.equal(typeof timestamp, 'string');
        assert.ok(score >= -1 && score <= 1, `score ${score} out of range`);
      }
    }
  });

  it('all timestamps are ISO strings within their parent hour', () => {
    for (const [key, items] of Object.entries(MOCK_PAYLOAD)) {
      const hourStart = new Date(key);
      const hourEnd = new Date(hourStart.getTime() + 3_600_000);
      for (const item of items) {
        const ts = new Date(item.timestamp);
        assert.ok(
          ts >= hourStart && ts < hourEnd,
          `timestamp ${item.timestamp} is not within hour ${key}`,
        );
      }
    }
  });
});

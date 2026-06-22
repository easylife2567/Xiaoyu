// ---------------------------------------------------------------------------
// Mock payload for the public-opinion overview sticky feed.
// Generates 24 hours of synthetic data starting from the current hour.
// ---------------------------------------------------------------------------

function seededRandom(seed) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const SAMPLE_TEXTS = [
  '网民对近期政策调整反应积极，认为有利于经济发展',
  '某品牌产品质量问题引发热议，消费者权益讨论升温',
  '体育赛事收视率创历史新高，全民健身热情高涨',
  '教育减负政策落地效果显现，家长群体反响不一',
  '科技创新成果显著，多项技术取得突破性进展',
  '环保议题关注度提升，垃圾分类措施获多数支持',
  '交通新规实施首日，市民出行体验明显改善',
  '房地产市场调控效果持续显现，房价趋于稳定',
  '医疗改革推进顺利，基层医疗服务能力增强',
  '乡村振兴战略实施成效显著，农村面貌焕然一新',
  '文化旅游市场持续升温，特色小镇建设稳步推进',
  '数字经济蓬勃发展，新业态新模式不断涌现',
  '养老服务体系建设加快，社区养老模式获认可',
  '食品安全监管力度加大，消费者信心逐步恢复',
  '网络安全法规完善，个人信息保护意识增强',
];

const SOURCES = ['微博', '知乎', '今日头条', '百度贴吧', '抖音', '微信公众号', 'B站', '小红书'];

const NUM_HOURS = 24;
const ITEMS_PER_HOUR = 12;

function makeMockPayload() {
  /** @type {Record<string, Array<{text:string,score:number,source:string,timestamp:string}>>} */
  const payload = {};

  // Pin the baseline to the current hour (server-local).
  const now = new Date();
  now.setMinutes(0, 0, 0);
  const baseline = now.getTime();

  const rand = seededRandom(42);

  for (let h = 0; h < NUM_HOURS; h++) {
    const hourStart = new Date(baseline - (NUM_HOURS - 1 - h) * 3_600_000);
    const key = hourStart.toISOString().slice(0, 13) + ':00:00Z';

    const items = [];
    for (let i = 0; i < ITEMS_PER_HOUR; i++) {
      const text = SAMPLE_TEXTS[Math.floor(rand() * SAMPLE_TEXTS.length)];
      const score = Math.round((rand() * 2 - 1) * 1000) / 1000;
      const source = SOURCES[Math.floor(rand() * SOURCES.length)];
      const offset = Math.floor(rand() * 3_600_000);
      const timestamp = new Date(hourStart.getTime() + offset).toISOString();
      items.push({ text, score, source, timestamp });
    }

    payload[key] = items;
  }

  return payload;
}

export const MOCK_PAYLOAD = makeMockPayload();

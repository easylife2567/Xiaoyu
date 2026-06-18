#!/usr/bin/env node
// Daily-report 候选池真实采集 (RSS) — 薄包装
//
// 调用 services/worker/daily_report/worker.py collect 子命令,把 stdout 透传出来。
// 与 roll-fixture.mjs 配套使用:
//   - roll-fixture: 拷贝最近一份 fixture 平移日期(本地 dev / 离线兜底)
//   - collect-pool: 真实从 RSS 抓取(联网 / 生产路径)
//
// 使用:
//   node scripts/daily-report/collect-pool.mjs --workflow international-daily-report
//                                              [--date 2026-06-18]
//                                              [--fixture-root /abs/path]
//                                              [--force]
//                                              [--timeout 15]
//
// 退出码:
//   0  成功(stdout 输出 worker 的 JSON 摘要)
//   1  参数缺失/非法
//   2  worker 返回 ok=false(stdout 仍包含 worker 的 JSON)

import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ISSUE_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function parseArgs(argv) {
  const args = { workflow: null, date: null, fixtureRoot: null, force: false, timeout: null }
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]
    switch (token) {
      case '--workflow':
        args.workflow = argv[++i]
        break
      case '--date':
        args.date = argv[++i]
        break
      case '--fixture-root':
        args.fixtureRoot = argv[++i]
        break
      case '--force':
        args.force = true
        break
      case '--timeout':
        args.timeout = argv[++i]
        break
      case '-h':
      case '--help':
        printHelp()
        process.exit(0)
        break
      default:
        process.stderr.write(`未知参数: ${token}\n`)
        process.exit(1)
    }
  }
  if (!args.workflow) {
    process.stderr.write('缺少 --workflow\n')
    printHelp()
    process.exit(1)
  }
  if (args.date && !ISSUE_DATE_PATTERN.test(args.date)) {
    process.stderr.write(`--date 必须为 YYYY-MM-DD,收到 ${args.date}\n`)
    process.exit(1)
  }
  return args
}

function printHelp() {
  process.stdout.write(
    [
      'Usage:',
      '  node scripts/daily-report/collect-pool.mjs --workflow <slug> [options]',
      '',
      'Options:',
      '  --workflow <slug>          (必填)workflow slug, 如 international-daily-report',
      '  --date <YYYY-MM-DD>        目标日期,默认今天',
      '  --fixture-root <path>      覆盖 fixture 写入根目录',
      '  --force                    覆盖已存在的目标 fixture',
      '  --timeout <seconds>        单 feed HTTP 超时秒数',
      '  -h, --help                 显示本帮助',
      '',
    ].join('\n'),
  )
}

function resolvePythonBinary() {
  if (process.env.XIAOYU_PYTHON_BIN) {
    return process.env.XIAOYU_PYTHON_BIN
  }
  const bundled = path.join(
    os.homedir(),
    '.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3',
  )
  return existsSync(bundled) ? bundled : 'python3'
}

function resolveWorkerScript() {
  const here = path.dirname(fileURLToPath(import.meta.url))
  // scripts/daily-report/ → repo root → services/worker/daily_report/worker.py
  const root = path.resolve(here, '..', '..')
  return path.resolve(root, 'services/worker/daily_report/worker.py')
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  const python = resolvePythonBinary()
  const script = resolveWorkerScript()

  const cliArgs = ['collect', '--workflow', args.workflow]
  if (args.date) cliArgs.push('--date', args.date)
  if (args.force) cliArgs.push('--force')
  if (args.fixtureRoot) cliArgs.push('--fixture-root', args.fixtureRoot)
  if (args.timeout) cliArgs.push('--timeout', String(args.timeout))

  const result = spawnSync(python, [script, ...cliArgs], {
    stdio: ['ignore', 'pipe', 'inherit'],
    maxBuffer: 32 * 1024 * 1024,
    encoding: 'utf8',
  })

  if (result.error) {
    process.stderr.write(`spawn 失败: ${result.error.message}\n`)
    process.exit(1)
  }

  // 透传 worker stdout(已经是单行 JSON)
  if (result.stdout) {
    process.stdout.write(result.stdout)
    if (!result.stdout.endsWith('\n')) {
      process.stdout.write('\n')
    }
  }

  process.exit(result.status ?? 0)
}

main()

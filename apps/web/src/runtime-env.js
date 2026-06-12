import path from 'node:path'
import nextEnv from '@next/env'

const { loadEnvConfig } = nextEnv

export function resolveRepositoryRoot(cwd = process.cwd()) {
  return cwd.endsWith(path.join('apps', 'web')) ? path.resolve(cwd, '../..') : cwd
}

export function loadRuntimeEnv(projectRoot = resolveRepositoryRoot()) {
  return loadEnvConfig(projectRoot, process.env.NODE_ENV !== 'production', console, true)
}

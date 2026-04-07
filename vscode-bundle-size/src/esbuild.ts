import {exec} from 'child_process'
import {promisify} from 'util'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFunction<T = void> = (...args: any[]) => T

function safeGet<T>(fn: AnyFunction<T>, defaultValue: T) {
  try {
    return fn()
  } catch (_) {
    return defaultValue
  }
}

const getEsbuildVersion = () =>
  safeGet(() => require('esbuild/package.json').version as string, '')
const command = promisify(exec)

/**
 * Get the right native executable of esbuild since it cannot be bundled
 * consider downloading: https://esbuild.github.io/getting-started/#download-a-build
 */
export const install = async (log: AnyFunction) => {
  const existing = getEsbuildVersion()
  if (existing) {
    log(`install: esbuild@${existing} found`)
    return
  }
  log('downloading esbuild on first use')
  let err: unknown
  for (const cmd of [
    'pnpm i --prod',
    'yarn --prod',
    'npm i --omit=dev',
    'bun i --production',
  ]) {
    await command(cmd, {cwd: __dirname}).catch((e) => {
      log(`install: \`${cmd}\` failed, skipping`)
      err = e
    })
    const version = getEsbuildVersion()
    if (version) {
      log(`install: esbuild@${version} via \`${cmd}\``)
      return
    }
  }
  return Promise.reject(err)
}

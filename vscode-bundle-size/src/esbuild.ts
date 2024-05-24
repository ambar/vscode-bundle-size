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

const hasEsbuild = () => safeGet(() => !!require.resolve('esbuild'), false)
const command = promisify(exec)

/**
 * Get the right native executable of esbuild since it cannot be bundled
 * consider downloading: https://esbuild.github.io/getting-started/#download-a-build
 */
export const install = async (onInstall: AnyFunction) => {
  if (hasEsbuild()) {
    return
  }
  onInstall()
  let err: unknown
  for (const cmd of ['pnpm i --prod', 'yarn --prod', 'npm i --prod']) {
    await command(cmd, {cwd: __dirname}).catch((e) => {
      err = e
    })
    if (hasEsbuild()) {
      return
    }
  }
  return Promise.reject(err)
}

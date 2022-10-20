import escalade from 'escalade'
import {promises as fs} from 'fs'
import {createRequire} from 'module'
import path from 'path'

export type Pkg = {
  name: string
  version: string
  description?: string
  homepage?: string
  repository?: string
  dependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
}

export const findPkg = (file: string) => {
  return escalade(file, (_, names) => {
    if (names.includes('package.json')) {
      return 'package.json'
    }
  })
}

const readJson = async (file: string) => {
  const content = await fs.readFile(file, 'utf-8')
  return JSON.parse(content) as Record<string, unknown>
}

const pkgName = 'package.json'
export const findPkgByName = (
  file: string,
  moduleName: string,
  callback?: (file: string, pkg: Pkg) => void
) => {
  return escalade(file, async (dir, names) => {
    if (names.includes(pkgName)) {
      const file = path.join(dir, pkgName)
      const json = (await readJson(file)) as Pkg
      callback?.(file, json)
      if (json.name === moduleName) {
        return pkgName
      }
    }
  })
}

export const findPkgs = async (modulePath: string, baseDir: string) => {
  const contextRequire = createRequire(path.resolve(baseDir, '<import>.js'))
  // ensure resolvable
  const moduleFile = contextRequire.resolve(modulePath)
  const isScoped = modulePath[0] === '@'
  const [p1, p2] = isScoped
    ? modulePath.split('/')
    : [modulePath.split('/')[0], '']
  const moduleName = p1 + (isScoped ? '/' : '') + p2
  let rootPkg: Pkg | void
  let rootPkgFile: string | void
  try {
    rootPkgFile = `${moduleName}/package.json`
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    rootPkg = require(rootPkgFile)
  } catch (_) {
    // This is probably: Package subpath './package.json' is not defined by "exports"
  }

  let modulePkg: Pkg | void
  let modulePkgFile: string | void
  if (moduleFile !== moduleName) {
    const pairs: [string, Pkg][] = []
    const pkgFile = await findPkgByName(moduleFile, moduleName, (x, y) => {
      pairs.push([x, y])
    })
    if (pkgFile && pairs.length > 0) {
      ;[rootPkgFile, rootPkg] = pairs[pairs.length - 1]
      if (pairs.length > 1) {
        ;[modulePkgFile, modulePkg] = pairs[0]
      }
    }
  }
  return {rootPkgFile, rootPkg, modulePkgFile, modulePkg}
}

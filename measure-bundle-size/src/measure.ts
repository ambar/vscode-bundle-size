import {promises as fs} from 'fs'
import path from 'path'
import bytes from 'bytes'
import Debug from 'debug'
import gzipSize from 'gzip-size'
import * as esbuild from 'esbuild'
import {builtinModules} from 'module'
import {parse, ImportInfo, exportImported} from './parse'
import analyzeMetafile from './analyzeMetafile'
import {findPkg, findPkgs, Pkg} from './findPkg'

const log = Debug('measure-bundle-size')

export const hasFile = async (file: string) =>
  Boolean(await fs.stat(file).catch(() => null))

export const pick = <T>(obj: T, keys: (keyof T)[]) =>
  keys.reduce((acc, k) => ((acc[k] = obj[k]), acc), {} as T)

const reBuiltin = RegExp(`^node:|^(${builtinModules.join('|')})(/|$)`)
/** ignore nested core modules  */
const builtinExternalPlugin: esbuild.Plugin = {
  name: 'external',
  setup(build) {
    build.onResolve({filter: reBuiltin, namespace: 'file'}, (args) => ({
      path: args.path,
      external: true,
    }))
  },
}
const reNonRelative = /^[a-z@]/
/** ignore nested peer deps  */
const peerExternalPlugin: esbuild.Plugin = {
  name: 'external',
  setup(build) {
    type CacheValue = Pkg | null
    const pkgCache = new Map<string, Promise<CacheValue>>()
    const externalsMap = new Map<string, Set<string>>()
    build.onResolve(
      {filter: reNonRelative, namespace: 'file'},
      async (args) => {
        if (reBuiltin.test(args.path)) {
          return null
        }
        // should passed by esbuild: https://github.com/evanw/esbuild/issues/978
        let pkg: CacheValue
        const cacheKey = args.resolveDir
        if (pkgCache.has(cacheKey)) {
          pkg = (await pkgCache.get(cacheKey)) as CacheValue
        } else {
          const result = findPkg(cacheKey).then((pkgFile) =>
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            pkgFile ? (require(pkgFile) as Pkg) : null
          )
          pkgCache.set(cacheKey, result)
          pkg = await result
        }
        if (pkg?.peerDependencies && args.path in pkg.peerDependencies) {
          let externals = externalsMap.get(pkg.name)
          if (!externals) {
            externals = new Set()
            externalsMap.set(pkg.name, externals)
          }
          externals.add(args.path)
          return {
            path: args.path,
            external: true,
          }
        }
      }
    )
    build.onEnd(() => {
      if (externalsMap.size) {
        log(`peer externals`, externalsMap)
      }
    })
  },
}

type StatsOpt = boolean | 'tree' | 'table'

type BundleResult = {
  size: number
  zippedSize: number
  human: {size: string; zippedSize: string}
  pkg?: Pkg
  pkgFile?: string
  modulePkg?: Pkg
  modulePkgFile?: string
  stats?: string
}

const bundleCache = new Map<string, BundleResult>()
const genCacheKey = (pkg: Pkg, names: string) =>
  `${pkg.name}:${pkg.version}:${names}`

const timeMark = <T extends string>() => {
  const startTimes = new Map<T, number>()
  const values = new Map<T, number>()
  return {
    start(label: T) {
      startTimes.set(label, Date.now())
    },
    end(label: T) {
      const startTime = startTimes.get(label)
      if (!startTime) {
        throw new Error(`No label: ${label}`)
      }
      values.set(label, Date.now() - startTime)
    },
    print() {
      return [...values].map(([k, v]) => `${k} in ${v}ms`).join(', ')
    },
  }
}

const pickPkgFields = (pkg: Pkg) => {
  return pick<Pkg>(pkg, [
    'name',
    'version',
    'description',
    'homepage',
    'dependencies',
    'peerDependencies',
  ])
}

const bundle = async (
  statement: string,
  importInfo: ImportInfo,
  {
    baseDir,
    projectPkgFile,
    stats: statsOpt = false,
    cache: cacheOpt = false,
  }: {
    baseDir: string
    projectPkgFile?: string | void
    stats?: StatsOpt
    cache?: boolean
  }
): Promise<BundleResult> => {
  const bundleMark = timeMark<'bundle' | 'zip' | 'analyze'>()
  const modulePath = importInfo.from
  const [part1] = modulePath.split('/')
  if (!/^[a-z@]/.test(part1)) {
    // file path, alias
    throw new Error('Skip non-npm packages')
  }
  if (reBuiltin.test(part1)) {
    throw new Error('Skip builtin modules')
  }
  const entryInput = `${statement}\n${exportImported(importInfo)}`
  type T = Awaited<ReturnType<typeof findPkgs>>
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const {rootPkgFile, rootPkg, modulePkgFile, modulePkg} = await findPkgs(
    modulePath,
    baseDir
  ).catch(() => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return
    return {} as T
  })

  const cacheKey =
    cacheOpt && rootPkg !== undefined && genCacheKey(rootPkg, entryInput)
  if (cacheOpt && cacheKey) {
    const cache = bundleCache.get(cacheKey)
    if (cache) {
      log('using cache:', importInfo.from)
      return cache
    }
  }

  bundleMark.start('bundle')
  // TODO: alert indirect deps, eg.: react-redux > react-dom
  // exclude peer deps, eg: react-router-dom > react
  const external = rootPkg ? Object.keys({...rootPkg.peerDependencies}) : []
  // reduce depth of relative path in `metafile`, can't resolve directly to `node_modules` because it may not exist (or in monorepo)
  const workingDir = projectPkgFile ? path.dirname(projectPkgFile) : baseDir
  /**
   * - build in memory, no file writing
   * - respect 'browser' field in package.json
   * - production build, respect `NODE_ENV`
   *
   * TODO: add loader for `.node`
   * @see https://esbuild.github.io/api/#build-api
   */
  const buildResult = await esbuild.build({
    stdin: {
      loader: 'ts',
      contents: entryInput,
      resolveDir: workingDir,
      sourcefile: '<import>',
    },
    outfile: '<bundle>.js',
    absWorkingDir: workingDir,
    plugins: [builtinExternalPlugin, peerExternalPlugin],
    external,
    target: 'esnext',
    format: 'esm',
    platform: 'browser',
    metafile: statsOpt !== false,
    minify: true,
    bundle: true,
    write: false,
  })
  bundleMark.end('bundle')

  // analyze on hover?
  let stats
  if (buildResult.metafile) {
    bundleMark.start('analyze')
    if (statsOpt === 'tree') {
      stats = await esbuild.analyzeMetafile(buildResult.metafile)
    } else if (statsOpt === 'table') {
      stats = analyzeMetafile(buildResult.metafile)
    }
    bundleMark.end('analyze')
    // if (stats) {
    //   log('stats:\n' + stats)
    // }
  }
  // concat <bundle>.js, <bundle>.css, etc
  bundleMark.start('zip')
  const sizes = await Promise.all(
    buildResult.outputFiles.map(async (file) => {
      const itsSize = file.contents.length
      return [
        itsSize,
        itsSize === 0 ? 0 : await gzipSize(Buffer.from(file.contents)),
      ] as [number, number]
    })
  )
  bundleMark.end('zip')
  let size = 0
  let zippedSize = 0
  for (const [s1, s2] of sizes) {
    size += s1
    zippedSize += s2
  }
  const human = {size: bytes(size), zippedSize: bytes(zippedSize)}
  log(`${bundleMark.print()}, ${statement}, ${human.size}`)
  const toRelative = path.relative.bind(null, process.cwd())
  const result = {
    size,
    zippedSize,
    human,
    pkg: rootPkg ? pickPkgFields(rootPkg) : undefined,
    pkgFile: rootPkgFile ? toRelative(rootPkgFile) : undefined,
    modulePkg: modulePkg ? pickPkgFields(modulePkg) : undefined,
    modulePkgFile: modulePkgFile ? toRelative(modulePkgFile) : undefined,
    stats,
  }
  if (cacheOpt && cacheKey) {
    bundleCache.set(cacheKey, result)
  }
  return result
}

export type MeasureResult = {
  importInfo: ImportInfo
  result?: BundleResult
  error?: Error | unknown
}

type MeasureOptions = {
  debug?: boolean
  stats?: StatsOpt
  cache?: boolean
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  log?: (...args: any[]) => void
  workspaceFolder?: string
}

export const measure = async (
  input: string,
  fileName?: string | null,
  opts: MeasureOptions = {}
): Promise<MeasureResult[]> => {
  if (opts.debug) {
    log.enabled = true
  }
  if (opts.log) {
    log.log = opts.log
  }

  log('process', fileName)
  const baseDir =
    fileName && (await hasFile(fileName))
      ? path.dirname(fileName)
      : opts.workspaceFolder && (await hasFile(opts.workspaceFolder))
      ? opts.workspaceFolder
      : null
  if (!baseDir) {
    throw new Error('Can not resolve `fileName` or `workspaceFolder`')
  }

  const projectPkgFile = await findPkg(baseDir)
  const parseMark = timeMark<'parse'>()
  parseMark.start('parse')
  const result = parse(input)
  parseMark.end('parse')
  log(parseMark.print())
  const bundleOpts = {
    baseDir,
    projectPkgFile,
    stats: opts.stats,
    cache: opts.cache,
  }
  return Promise.all(
    result.imports.map(async (importInfo) => {
      const statement = input.substring(importInfo.start, importInfo.end)
      return bundle(statement, importInfo, bundleOpts).then(
        (result) => ({
          importInfo,
          result,
          error: void 0,
        }),
        (error: Error) => ({
          importInfo,
          result: void 0,
          error,
        })
      )
    })
  )
}

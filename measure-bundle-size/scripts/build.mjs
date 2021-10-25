/* eslint-disable no-console */
import {execSync} from 'child_process'
import module from 'module'
import fs from 'fs'
import esbuild from 'esbuild'

const pkg = JSON.parse(fs.readFileSync('package.json'))

const main = async () => {
  const {errors} = await esbuild.build({
    bundle: true,
    entryPoints: [pkg.source],
    outfile: pkg.main,
    format: 'cjs',
    platform: 'node',
    target: 'node12',
    external: Object.keys(pkg.dependencies).concat(module.builtinModules),
    minifySyntax: true,
    define: {
      'process.env.NODE_ENV': `'production'`,
    },
    watch: process.argv.includes('--watch')
      ? {
          onRebuild(err) {
            console.info('[watch] build finished')
            if (err && err.errors) {
              console.error(esbuild.formatMessages(err.errors))
            }
          },
        }
      : false,
  })

  if (errors.length) {
    throw new Error(esbuild.formatMessages(errors))
  } else {
    execSync(
      `echo 'build finished:' && wc -c ${pkg.main} && gzip -c ${pkg.main} | wc -c`,
      {
        stdio: 'inherit',
      }
    )
  }
}

main()

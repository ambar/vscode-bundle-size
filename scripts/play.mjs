/* eslint-disable no-console */
import fs from 'fs/promises'
import path from 'path'
import minimist from 'minimist'
import {measure} from 'measure-bundle-size'

const args = minimist(process.argv.slice(2), {
  string: ['w', 'e', 'f'],
})

/**
 * ```sh
 * DEBUG=* node play.mjs -f <file>
 * DEBUG=* node play.mjs -w <workspace> -e "import React from 'react'"
 * ```
 */
const main = async () => {
  const input = args.f ? String(await fs.readFile(args.f)) : args.e
  const result = await measure(input, args.f, {
    workspaceFolder: args.w && path.resolve(args.w),
    stats: 'table',
  })
  console.info(result)
  console.info(result.find((r) => r.result).result.stats)
}

main()

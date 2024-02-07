/* eslint-disable no-console */
import fs from 'node:fs/promises'
import path from 'node:path'
import {createInterface} from 'node:readline'
import minimist from 'minimist'
import {measure} from 'measure-bundle-size'

const args = minimist(process.argv.slice(2), {
  string: ['w', 'e', 'f'],
  boolean: ['stdin'],
})

const getStdin = async () => {
  const result = []
  for await (const line of createInterface({input: process.stdin})) {
    result.push(line)
  }
  return result.join('\n')
}

/**
 * ```sh
 * DEBUG=* node play.mjs -f <file>
 * DEBUG=* node play.mjs -w <workspace> -e "import React from 'react'"
 * DEBUG=* cat <file> | node play.mjs -w <workspace> --stdin
 * ```
 */
const main = async () => {
  const input = args.f
    ? String(await fs.readFile(args.f))
    : args.stdin
    ? await getStdin()
    : args.e
  const result = await measure(input, args.f, {
    workspaceFolder: args.w && path.resolve(args.w),
    stats: 'table',
  })
  console.info(result)
  console.info(result.find((r) => r.result).result.stats)
}

main()

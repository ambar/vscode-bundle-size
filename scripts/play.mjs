/* eslint-disable no-console */
import path from 'path'
import minimist from 'minimist'
import {measure} from 'measure-bundle-size'

const args = minimist(process.argv.slice(2), {
  string: ['w', 'e'],
})

/**
 * ```sh
 * DEBUG=* node play.mjs -w <workspace> -e "import React from 'react'"
 * ```
 */
const main = async () => {
  const result = await measure(args.e, null, {
    workspaceFolder: path.resolve(args.w),
    stats: 'table',
  })
  console.info(result)
  console.info(result[0].result.stats)
}

main()

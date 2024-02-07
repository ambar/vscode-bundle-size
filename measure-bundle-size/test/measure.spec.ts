/* eslint-disable @typescript-eslint/no-non-null-assertion */
import path from 'path'
import dedent from 'dedent'
import {measure, MeasureResult} from '../src/measure'

// zlib different on mac/linux: https://github.com/nodejs/node/issues/12244
const snapshot = (values: MeasureResult[]) => {
  const maskSize = (value: number | string) => {
    if (typeof value === 'number') {
      return `${String(value)[0]}`.padEnd(String(value).length, '*')
    }
    const [size, unit] = value.split(/(B|KB|MB)/g)
    return size[0].padEnd(size.length - unit.length + 1, '*') + unit
  }

  expect(
    values.map((r) => {
      const result = r?.result
      if (result) {
        return {
          ...r,
          result: {
            ...result,
            zippedSize: maskSize(result.zippedSize),
            human: {
              ...result.human,
              zippedSize: maskSize(result.human.zippedSize),
            },
          },
        }
      }
      return r
    })
  ).toMatchSnapshot()
}

const inputs = [
  // skip node core
  `
    import path from 'path'
    import fs from 'fs/promise'
    import url from 'node:url'
    `,

  // skip relative
  `
    import * as utils from './utils'
    `,
  // CJS package: path import
  `
    import map from 'lodash/map'
    `,
  // CJS package: main entry
  `
    import {map} from 'lodash'
    `,
  // ESM package: main entry
  `
    import {lightFormat} from 'date-fns'
    `,
  // namespace: usingProps=0
  `
    import * as dateFns from 'date-fns'
    `,
  // namespace: usingProps=0, has scope name
  `
    import * as dateFns from 'date-fns'
    {
      let dateFns = {}
      {
        dateFns.addDays
      }
      void (function(dateFns) {
        dateFns.addDays()
      }())
    }
    `,
  // namespace: usingProps=1
  `
    import * as dateFns from 'date-fns'
    dateFns.addDays
    `,
  // tree-shaking NODE_ENV=production
  `
    import React from 'react'
  `,
  // exclude peer deps (react)
  `
    import 'react-inline-center'
  `,
  // scoped path
  `
    import factory from '@ambarli/alias/factory'
  `,
  // bundle CSS
  `
    import 'sanitize.css'
    import 'sanitize.css/forms.css'
  `,
]

test.each(inputs)('measure %p', async (input) => {
  snapshot(await measure(dedent(input), __filename))
})

test('throw', async () => {
  await expect(measure(``)).rejects.toThrow(
    /Can not resolve `fileName` or `workspaceFolder`/
  )
})

test('debug', async () => {
  const log = jest.fn()
  expect(await measure(``, __filename, {debug: true, log})).toEqual([])
  expect(log).toBeCalled()
})

test('analyze', async () => {
  // resolved to project root
  const [r] = await measure(`import React from 'react'`, __filename, {
    stats: 'table',
  })
  expect(r.result!.stats).toMatchSnapshot()
})

test('alias in tsconfig', async () => {
  const [r] = await measure(`import magic from 'pkg-mylib'`, null, {
    workspaceFolder: path.resolve(__dirname, 'fixtures/alias-mylib'),
    stats: 'table',
  })
  expect(r.result!.stats).toMatchSnapshot()
})

test('add ellipsis for files', async () => {
  const [r] = await measure(`import debounce from 'lodash/debounce'`, null, {
    workspaceFolder: __dirname,
    stats: 'table',
  })
  expect(r.result!.stats).toMatchSnapshot()
})

test('no package.json in exports', async () => {
  const [r] = await measure(`import escalade from 'escalade'`, null, {
    workspaceFolder: __dirname,
    stats: 'table',
  })
  expect(r.result!.stats).toMatchSnapshot()
})

test('parse flow type', async () => {
  const [r] = await measure(
    `import {registerAsset} from '@react-native/assets/registry'`,
    null,
    {
      workspaceFolder: __dirname,
      stats: 'table',
    }
  )
  expect(r.result!.stats).toMatchSnapshot()
})

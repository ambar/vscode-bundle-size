# measure-bundle-size

[![Coverage Status](https://coveralls.io/repos/github/ambar/vscode-bundle-size/badge.svg?branch=main)](https://coveralls.io/github/ambar/vscode-bundle-size?branch=main)
[![npm version](https://badgen.net/npm/v/measure-bundle-size)](https://www.npmjs.com/package/measure-bundle-size)
![](https://badgen.net/npm/types/measure-bundle-size)

## Install

```sh
yarn add measure-bundle-size
```

## Usage

```ts
import {measureIterable, measure, type MeasureResult} from 'measure-bundle-size'

type MeasureOptions = {
  debug?: boolean
  log?: (...args: any[]) => void
  stats?: boolean | 'tree' | 'table'
  workspaceFolder?: string
  flowPattern?: RegExp
}

// Lazy async generator API
type measureIterable = (input: string, fileName?: string | null, MeasureOptions) => AsyncGenerator<MeasureResult>

for await (const result of measureIterable(`code`, __filename, {
  debug: true,
  log: () => {},
  stats: 'table',
  workspaceFolder: '.',
})) {
  //
}

// Promise API
type measure = (input: string, fileName?: string | null, MeasureOptions) => Promise<MeasureResult[]>

const results = await measure(`code`, __filename, {
  debug: true,
  log: () => {},
  stats: 'table',
  workspaceFolder: '.',
})
```

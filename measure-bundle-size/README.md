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
import {measure} from 'measure-bundle-size'

type mesure = (input: string, fileName?: string | null, {
    debug?: boolean
    log?: (...args: any[]) => void
    stats?: boolean | 'tree' | 'table'
    workspaceFolder?: string
}) => Result

const result = measure(`code`, __filename, {
  debug: true,
  log: () => {},
  stats: 'table',
  workspaceFolder: '.',
})
```

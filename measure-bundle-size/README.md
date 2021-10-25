# measure-bundle-size

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

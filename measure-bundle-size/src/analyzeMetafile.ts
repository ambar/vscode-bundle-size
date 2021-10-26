import path from 'path'
import bytes from 'bytes'
import * as esbuild from 'esbuild'

const groupBy = <T, K = string>(list: T[] = [], fn: (x: T) => K) => {
  const group = new Map<K, T[]>()
  for (const x of list) {
    const key = fn(x)
    const value = group.get(key)
    if (value) {
      value.push(x)
    } else {
      group.set(key, [x])
    }
  }
  return group
}

const splitModuleName = (modulePath = '') => {
  const [p1, p2, ...rest] = modulePath.split(path.sep)
  return p1.startsWith('@')
    ? [p1 + '/' + p2, rest.join(path.sep)]
    : [p1, [p2, ...rest].join(path.sep)]
}

const npmDir = 'node_modules'
const maxFilesInCell = 10

/**
 * Like `esbuild.analyzeMetafile`, but:
 * - render to markdown table
 * - more compact, accumulate files in same module
 * - strip common ancestor directory
 */
export default function analyzeMetafile(data: esbuild.Metafile) {
  const {outputs} = data
  const markdown: string[] = []

  for (const [outputName, outputStats] of Object.entries(outputs)) {
    const {entryPoint, inputs, bytes: totalBytes} = outputStats
    const list = Object.entries(inputs).map(([x, {bytesInOutput}]) => {
      let names: {parent: string; head: string; file: string}
      let index: number
      if (x === entryPoint) {
        names = {parent: '', head: x, file: ''}
      } else if ((index = x.indexOf(npmDir)) !== -1) {
        // handle node modules
        const parent = x.slice(0, index)
        const [moduleName, part2] = splitModuleName(
          x.slice(index + npmDir.length + 1)
        )
        names = {parent, head: moduleName, file: part2}
      } else {
        // handle alias from tsconfig/jsconfig
        const reParent = /^((\.\.[/\\])+)/
        const [part1, parent, _, rest] = x.split(reParent)
        if (parent) {
          names = {
            parent,
            head: path.dirname(rest),
            file: path.basename(rest),
          }
        } else {
          names = {
            parent,
            head: path.dirname(part1),
            file: path.basename(part1),
          }
        }
      }
      return {names, bytesInOutput}
    })
    const group = groupBy(list, (x) => x.names.parent)
    const nameGrouped = [...group].map(([_, entries]) => {
      return groupBy(entries, (x) => x.names.head)
      // TODO: show parent dir if needed, alert duplicates
      // return groupBy(entries, (x) => x.names[0] + x.names[1])
    })

    const head = ['Input', 'Files', 'Size', 'Percent']
    const lines = [
      `| ${head.join(' | ')} |`,
      `| ${head.map(() => '---').join(' | ')} |`,
    ]
    const leadingRow = {
      name: outputName,
      files: '',
      size: totalBytes,
      percent: '100%',
    }
    const rows = [leadingRow]
    for (const map of nameGrouped) {
      for (const [name, group] of map) {
        const files = group
          .map((x) => ({name: x.names.file, size: x.bytesInOutput}))
          .sort((a, b) => b.size - a.size)
        const bytesAcc = group.reduce((acc, x) => acc + x.bytesInOutput, 0)
        if (bytesAcc === 0) {
          continue
        }
        const percent = ((bytesAcc / totalBytes) * 100).toFixed(1) + '%'
        const getFiles = () => {
          if (files.length === 1) {
            return files[0].name
          }
          const format = (x: typeof files[0]) => `${x.name} (${bytes(x.size)})`
          if (files.length > maxFilesInCell) {
            const rest = files.slice(maxFilesInCell)
            const restSize = rest.reduce((acc, x) => acc + x.size, 0)
            return (
              files.slice(0, maxFilesInCell).map(format).join(', ') +
              `, and ${rest.length} other ${
                rest.length > 1 ? 'files' : 'file'
              } (${bytes(restSize)})`
            )
          }
          return files.map(format).join(', ')
        }
        rows.push({
          name: '↪ ' + name,
          files: getFiles(),
          size: bytesAcc,
          percent,
        })
      }
    }
    const maxLen = Math.max(...rows.map((r) => r.files.length))
    if (maxLen < 10) {
      // spread table
      leadingRow.files = '&nbsp; '.repeat(10)
    }
    const code = (text: string) => `\`${text}\``
    for (const row of rows.sort((a, b) => b.size - a.size)) {
      const cells = [code(row.name), row.files, bytes(row.size), row.percent]
      lines.push(`| ${cells.join(' | ')} |`)
    }
    markdown.push(lines.join('\n'))
  }

  return markdown.join('\n\n')
}

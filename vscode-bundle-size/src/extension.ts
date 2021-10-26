import * as vscode from 'vscode'
import {format} from 'pretty-format'
import type {measure as measureFn, MeasureResult} from 'measure-bundle-size'
import {install} from './esbuild'

const output = vscode.window.createOutputChannel('Bundle Size')

const jsLanguageIds = [
  'javascript',
  'javascriptreact',
  'typescript',
  'typescriptreact',
]

const getColor = (size: number) => {
  const config = vscode.workspace.getConfiguration('bundleSize')
  const sizeKB = size / 1024
  if (sizeKB >= config.dangerSize) {
    return '#e33'
  } else if (sizeKB >= config.cautionSize) {
    return '#ea0'
  }
  return '#090'
}

const channelLog: AnyVoidFunction = (...args) => {
  // eslint-disable-next-line no-console
  console.log(...args)
  output.appendLine(
    args
      .map((x) => (typeof x === 'object' ? format(x, {min: true}) : String(x)))
      .join(' ')
  )
}
const log: AnyVoidFunction = (...args) => {
  channelLog(new Date().toJSON(), 'extension', ...args)
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyVoidFunction = (...args: any[]) => void

type DecorationInfo = {
  measure: MeasureResult
  decoration: vscode.DecorationOptions
}
const documentDecorationInfoMap = new WeakMap<
  vscode.TextDocument,
  DecorationInfo[]
>()

let installPromise: ReturnType<typeof install>
let lastWorkspaceFolder: vscode.WorkspaceFolder | void
export function activate(context: vscode.ExtensionContext) {
  log('Bundle Size is now active!')
  installPromise = install(() => log('downloading esbuild on first use'))
  installPromise.catch(log)

  // on initial
  void processDocument(vscode.window.activeTextEditor?.document)
  // on file open/close
  vscode.window.onDidChangeActiveTextEditor((e) => {
    if (e && !e.document.isUntitled) {
      lastWorkspaceFolder = vscode.workspace.getWorkspaceFolder(e.document.uri)
    }
    void processDocument(e?.document)
  })

  // on file changes
  vscode.workspace.onDidChangeTextDocument(
    debounce((e) => {
      void processDocument(e.document)
    }, 300)
  )

  vscode.languages.registerHoverProvider(jsLanguageIds, {
    provideHover(document, position) {
      const decorationInfo = documentDecorationInfoMap.get(document)
      if (!decorationInfo) {
        return
      }
      const info = decorationInfo.find((x) =>
        x.decoration.range.contains(position)
      )
      if (info) {
        const {result, error} = info.measure
        // line break or para break: https://github.com/microsoft/vscode/issues/86291#issuecomment-561841915
        const lb = '  \n'
        const pb = '\n\n'
        const block = (text: string, type = 'text') =>
          '```' + type + lb + text + lb + '```'
        if (error) {
          return {contents: [`Bundle Error:${pb} ${format(error)}`]}
        } else if (result) {
          const {pkgFile, pkg, stats} = result
          const info = [
            // headline
            [
              `${pkg.name}&commat;${pkg.version}`,
              `[package.json](<${pkgFile}>)`,
              pkg.homepage && `${pkg.homepage}`,
              pkg.description && pkg.description.length < 30 && pkg.description,
            ]
              .filter(Boolean)
              .join(' | ') + lb,
          ]
            .filter(Boolean)
            .join('')
          return {
            contents: [
              info,
              stats,
              block(JSON.stringify(pkg, null, '  '), 'json'),
            ].filter(Boolean) as string[],
          }
        }
      }
    },
  })
}

export function deactivate() {
  //
}

const decorationType = vscode.window.createTextEditorDecorationType({
  // prevent conflicts:
  // https://github.com/microsoft/vscode/issues/33852
  // https://github.com/eamodio/vscode-gitlens/blob/main/src/annotations/lineAnnotationController.ts#L25
  after: {margin: '0 0 0 3em'},
  rangeBehavior: vscode.DecorationRangeBehavior.ClosedOpen,
})

async function processDocument(document?: vscode.TextDocument) {
  if (!document || !jsLanguageIds.includes(document.languageId)) {
    return
  }
  const editor = vscode.window.activeTextEditor
  if (!editor) {
    return
  }
  await installPromise

  // clear console & decoration
  output.clear()
  editor.setDecorations(decorationType, [])
  documentDecorationInfoMap.set(document, [])

  const {fileName} = document
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const {measure} = require('measure-bundle-size') as {
    measure: typeof measureFn
  }
  const results = await measure(document.getText(), fileName, {
    cache: true,
    debug: true,
    stats: 'table',
    log: channelLog,
    workspaceFolder: lastWorkspaceFolder?.uri.fsPath,
  }).catch((error) => {
    log('measure:error', error)
    return null
  })
  if (!results || editor !== vscode.window.activeTextEditor) {
    return
  }

  const decorationInfo: DecorationInfo[] = []
  for (const measure of results) {
    const {importInfo, result, error} = measure
    if (result) {
      const pos = editor.document.positionAt(importInfo.end)
      const contentText = `${result.human.size} (${result.human.zippedSize} zipped)`
      const decoration = {
        range: new vscode.Range(pos, pos),
        renderOptions: {after: {contentText, color: getColor(result.size)}},
      }
      decorationInfo.push({decoration, measure})
    } else {
      // show error in editor?
      if (!/Skip/.test((error as Error)?.message)) {
        log('exception', measure.importInfo.from, error)
      }
    }
  }

  if (decorationInfo.length) {
    editor.setDecorations(
      decorationType,
      decorationInfo.map((x) => x.decoration)
    )
    documentDecorationInfoMap.set(document, decorationInfo)
  }
}

function debounce<T extends AnyVoidFunction>(fn: T, wait: number) {
  let timer: number | undefined
  return function () {
    if (timer) {
      clearTimeout(timer)
    }
    // eslint-disable-next-line prefer-rest-params
    timer = setTimeout(fn.apply.bind(fn, void 0, arguments), wait)
  } as T
}

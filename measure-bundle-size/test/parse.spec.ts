import {parse, exportImported} from '../src/parse'

// https://mdn.io/import
const syntaxInput = `
import defaultExport from "module-1"
import * as name from "module-2"
import { export1 } from "module-3"
import { export1 as alias1 } from "module-4"
import { export2 , export3 } from "module-5"
import { export4 , export5 as alias2 } from "module-6"
import defaultExport2, { export6 } from "module-7"
import defaultExport3, * as name2 from "module-8"
// https://github.com/tc39/ecma262/pull/2154
import {'string literal' as name3} from "module-9"
import "module-10"
`.trim()

const namespaceInput = `
import * as name from "module";

// using
{
  if (true) {
    name.using1()
    typeof name.using2
  }
}

export let foo = name.using3
export let jsx = <name.using4 />

// redeclare: block
{
  let name = {}
  name.foo()
}

// redeclare: parent block
{
  let name = {}
  if (true) {
    name.foo()
  }
}

// redeclare: hoisted function declaration
{
  name.foo()
  function name() {}
}

// redeclare: deconstruct object
{
  let {name} = {}
  name.foo()
}

// redeclare: deconstruct object rest
{
  let {...name} = {}
  name.foo()
}

// redeclare: deconstruct array
{
  let [name] = []
  name.foo()
}

// redeclare: deconstruct array rest
{
  let [...name] = []
  name.foo()
}

// redeclare: params in FunctionDeclaration
{
  function f1(name) {
      name.foo()
  }
  function f2(...name) {
      name.foo()
  }
}

// redeclare: params in FunctionExpression
{
  void function (name) {
      name.foo()
  }
  void function (...name) {
      name.foo()
  }
}

// redeclare: params in ArrowFunctionExpression
{
  (name) => {
    name.foo()
  }
  (...name) => {
    name.foo()
  }
}

// redeclare: params in CatchClause
{
  try {
  } catch(name) {
    name.foo()
  }
}
`

test('syntax', () => {
  const result = parse(syntaxInput)
  expect(result).toMatchSnapshot('result')
  expect(result.imports.map(exportImported)).toMatchSnapshot('exportImported')
})

test('namespace', () => {
  const result = parse(namespaceInput)
  expect(result).toMatchInlineSnapshot(`
    Object {
      "imports": Array [
        Object {
          "end": 32,
          "from": "module",
          "namespace": Object {
            "name": "name",
            "usingProps": Array [
              Object {
                "end": 74,
                "name": "using1",
                "start": 63,
              },
              Object {
                "end": 99,
                "name": "using2",
                "start": 88,
              },
              Object {
                "end": 135,
                "name": "using3",
                "start": 124,
              },
              Object {
                "end": 165,
                "name": "using4",
                "start": 154,
              },
            ],
          },
          "start": 1,
        },
      ],
    }
  `)
  expect(result.imports.map(exportImported)).toMatchInlineSnapshot(`
    Array [
      "export default [name.using1, name.using2, name.using3, name.using4]",
    ]
  `)
})

test('hashbang', () => {
  expect(parse(`#!/usr/bin/env node`)).toMatchInlineSnapshot(`
    Object {
      "imports": Array [],
    }
  `)
})

test('jsx', () => {
  expect(parse(`export default <div />`)).toMatchInlineSnapshot(`
    Object {
      "imports": Array [],
    }
  `)
})

test('ts', () => {
  expect(parse(`type t = 0`)).toMatchInlineSnapshot(`
    Object {
      "imports": Array [],
    }
  `)
})

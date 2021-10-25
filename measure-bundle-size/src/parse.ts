import * as parser from '@babel/parser'
import traverse, {NodePath} from '@babel/traverse'
import * as t from '@babel/types'

type Namespace = {
  name: string
  usingProps: {
    start: number
    end: number
    name: string
  }[]
}

export type ImportInfo = {
  start: number
  end: number
  from: string
  names?: Record<string, string>
  namespace?: Namespace
}

export type ParseResult = {
  imports: ImportInfo[]
}

export const parse = (input: string): ParseResult => {
  const ast = parser.parse(input, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript'],
  })
  if (ast.errors.length) {
    throw new Error(ast.errors[0].code)
  }
  const format = (x: t.ImportDeclaration) => {
    const {start, end, specifiers, source} = x
    const info: ImportInfo = {
      start: start as number,
      end: end as number,
      from: source.value,
    }
    for (const s of specifiers) {
      if (s.type === 'ImportNamespaceSpecifier') {
        info.namespace = {name: s.local.name, usingProps: []}
      } else if (s.type === 'ImportDefaultSpecifier') {
        info.names ||= {}
        info.names.default = s.local.name
      } else if (s.type === 'ImportSpecifier') {
        info.names ||= {}
        info.names[
          s.imported.type === 'StringLiteral'
            ? s.imported.value
            : s.imported.name
        ] = s.local.name
      }
    }
    return info
  }

  // top level only
  const imports = ast.program.body
    .filter((x) => x.type === 'ImportDeclaration')
    .map((x) => format(x as t.ImportDeclaration))

  const namespaces = imports
    .map((x) => x.namespace)
    .filter(Boolean) as Namespace[]
  if (namespaces.length) {
    const names = new Set(namespaces.map((x) => x.name))
    const createVisitor =
      <T extends t.Identifier | t.JSXIdentifier>(
        type: 'MemberExpression' | 'JSXMemberExpression',
        propType: 'Identifier' | 'JSXIdentifier'
      ) =>
      (path: NodePath<T>) => {
        const {name} = path.node
        if (!names.has(name)) {
          return
        }
        const {parent} = path
        if (parent.type === type) {
          const binding = path.scope.getBinding(name)
          if (
            binding &&
            binding.path.node.type === 'ImportNamespaceSpecifier'
          ) {
            const namespace = namespaces.find(
              (e) => e.name === name
            ) as Namespace
            // ignore Expression | PrivateName
            if (parent.property.type === propType) {
              namespace.usingProps.push({
                start: parent.start as number,
                end: parent.end as number,
                name: parent.property.name,
              })
            }
          }
        }
      }
    traverse(ast, {
      Identifier: createVisitor<t.Identifier>('MemberExpression', 'Identifier'),
      JSXIdentifier: createVisitor<t.JSXIdentifier>(
        'JSXMemberExpression',
        'JSXIdentifier'
      ),
    })
  }

  return {imports}
}

export const exportImported = (info: ImportInfo) => {
  const {names, namespace} = info
  return [
    names && `export {${Object.values({...names}).join(', ')}}`,
    namespace?.usingProps.length &&
      `export default [${namespace.usingProps
        .map((x) => `${namespace.name}.${x.name}`)
        .join(', ')}]`,
  ]
    .filter(Boolean)
    .join('\n')
}

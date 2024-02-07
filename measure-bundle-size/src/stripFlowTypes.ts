import {transform} from 'sucrase'

/**
 * Strip flow types from the given source code.
 *
 * Why sucrase is used instead of babel, bundle size of this package:
 * - `sucrase`: 848kb -> 1.1mb
 * - `@babel/core` (with `@babel/plugin-transform-flow-strip-types`): 848kb -> 5.7mb
 */
export function stripFlowTypes(source: string, filename?: string) {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
  const result = transform(source, {
    transforms: ['flow', 'jsx', 'imports'],
    jsxRuntime: 'automatic',
    production: true,
    filePath: filename,
  })
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access
  return result.code
}

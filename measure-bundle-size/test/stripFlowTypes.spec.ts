import {stripFlowTypes} from '../src/stripFlowTypes';

test('stripFlowTypes', () => {
  const code = `
const countries = {
  US: "United States",
  IT: "Italy",
  FR: "France"
};

type Country = $Keys<typeof countries>;

export const italy: Country = 'IT';
export const foo = <div />
`
    expect(stripFlowTypes(code)).toMatchSnapshot()
})

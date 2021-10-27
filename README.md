# bundle-size

Display the bundle size of npm packages.

## Features

- Lightning fast, instantly show bundle result, powered by [esbuild](https://github.com/evanw/esbuild)
- Support JSX/Typescript/CSS
- For namespace (`* as`) imports, only count in-use properties
- Bundle in memory and locally, no file writing, no extra installation
- Provide hover card of bundle statistics

Preview basic usage:

![preview basic](./images/preview.png)

Preview namespace imports:

![preview namespace](./images/preview-namespace.png)

Preview hover card:

![preview hover](./images/preview-hover.png)

## Requirements

Because this extension builds locally, you need to pre-install dependencies.

## Extension Settings

```jsonc
{
  "bundleSize.cautionSize": {
    "type": "number",
    "default": 50,
    "description": "Size limit in KB, display caution color if exceeded"
  },
  "bundleSize.dangerSize": {
    "type": "number",
    "default": 100,
    "description": "Size limit in KB, display danger color if exceeded"
  }
}
```

## Known Issues

- Only import declaration is supported (no plan for `require()` statement)

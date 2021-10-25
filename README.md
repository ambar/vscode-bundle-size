# bundle-size

Display the bundle size of npm packages.

## Features

- Lightning fast, instantly show bundle result, powered by [esbuild](https://github.com/evanw/esbuild)
- Support JSX/Typescript/CSS
- For namespace (`* as`) imports, only count in-use properties
- Bundle in memory and locally, no file writing, no extra installation
- Provide hover card of bundle statistics

Preview basic usage:

![preview basic](./vscode-bundle-size/images/preview.png)

Preview namespace imports:

![preview namespace](./vscode-bundle-size/images/preview-namespace.png)

Preview hover card:

![preview hover](./vscode-bundle-size/images/preview-hover.png)

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

---

## Following extension guidelines

Ensure that you've read through the extensions guidelines and follow the best practices for creating your extension.

- [Extension Guidelines](https://code.visualstudio.com/api/references/extension-guidelines)

### For more information

- [Visual Studio Code's Markdown Support](http://code.visualstudio.com/docs/languages/markdown)
- [Markdown Syntax Reference](https://help.github.com/articles/markdown-basics/)

**Enjoy!**

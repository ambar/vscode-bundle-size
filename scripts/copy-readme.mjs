import fs from 'fs'

const readme = fs.readFileSync('vscode-bundle-size/README.md').toString()

// workaround: cannot use soft link for images in GitHub repo
fs.writeFileSync(
  'README.md',
  readme.replace(/\.\/images\//g, './vscode-bundle-size/images/')
)

#!/usr/bin/env node

// @ts-check

const fail = msg => {
  console.error("⛔️", msg)
  process.exit(1)
}

const log = msg => {
  console.log("∙", msg)
}

const fs = require("fs")
const path = require("path")
const spawnSync = require("child_process").spawnSync

const packageName = process.argv[2]
const packageDir = path.join("packages", packageName)

/** SETUP & SANITY CHECKS **/

if (!fs.existsSync("packages") || !fs.statSync("packages").isDirectory()) {
  fail("./packages directory not found")
}

if (fs.existsSync(packageDir)) {
  fail(`Package named ${packageName} already exists`)
}

if (!fs.existsSync("lerna.json")) {
  fail("Unable to find ./lerna.json")
}

// @ts-ignore
const version = JSON.parse(fs.readFileSync("./lerna.json").toString()).version
if (!version) {
  fail("Unable to find version number in ./lerna.json")
}

/** BUILDING THE THING **/

log(`Making ${packageDir}`)
fs.mkdirSync("packages/" + packageName)

log(`Initialising yarn project`)
spawnSync("yarn", ["init", "--yes"], { cwd: packageDir })

log("Adding @kfs scope and setting version number")
const packageJson = require(path.resolve(
  process.cwd(),
  packageDir,
  "package.json"
))
packageJson.files = ["README.md", "LICENSE", "dist"]
packageJson.name = "@kfs/" + packageName
packageJson.version = version
packageJson.main = `dist/${packageName}.js`
packageJson["lint-staged"] = {
  "*.ts": ["prettier --no-semi --trailing-comma=all --list-different"],
}
packageJson.scripts = {
  test: "jest",
  precommit: "lint-staged",
  lint:
    "prettier --no-semi --trailing-comma=all --list-different '**/*.ts' '**/*.js' '**/*.tsx",
  prepush: "yarn type-check",
  "type-check": "tsc --noEmit --project tsconfig.json",
  build: "tsc",
  clean: "rimraf dist *.tgz",
  prepack: "rimraf dist/**/*.test.js dist/**/__*",
  prepublishOnly: "yarn run clean && yarn run build",
}
fs.writeFileSync(
  path.join(packageDir, "package.json"),
  JSON.stringify(packageJson, null, "  ")
)

log("Setting up dev dependencies")
spawnSync("yarn", [
  "workspace",
  "@kfs/" + packageName,
  "add",
  "--dev",
  "typescript",
  "prettier",
  "@types/jest",
  "jest",
  "ts-jest",
  "lint-staged",
  "husky",
])
fs.writeFileSync(
  path.join(packageDir, "jest.config.js"),
  `module.exports = require("../../common/jest.config")\n`
)
fs.writeFileSync(
  path.join(packageDir, "tsconfig.json"),
  `{
  "compilerOptions": {
    "target": "ES2017",
    "module": "commonjs",
    "lib": ["es2015", "es2016", "es2017"],
    "outDir": "./dist",
    "noEmitOnError": false,
    "strict": true,
    "esModuleInterop": true
  }
}
`
)
fs.writeFileSync(
  path.join(packageDir, "LICENSE"),
  `Copyright (c) ${new Date().getFullYear()} David Sheldrick

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
`
)
fs.writeFileSync(
  path.join(packageDir, "README.md"),
  `# @kfs/${packageName}

TODO: write readme
  `
)
fs.mkdirSync(path.join(packageDir, "src"))
fs.writeFileSync(
  path.join(packageDir, "src", `${packageName}.ts`),
  `console.log('hello world')`
)

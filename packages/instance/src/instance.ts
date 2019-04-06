const start = Date.now()

import fs from "fs"
import path from "path"
import semver from "semver"
import * as lockfile from "@yarnpkg/lockfile"
import { getPackageTarballPath } from "./package-cache"

const rootDir = process.argv[2]

const myVersion = semver.parse(require("../package.json").version)

if (!myVersion) {
  throw new Error("can't parse own semver")
}

console.log(`Bootstrapping kfs in ${rootDir}`)

console.log("Finding kfs package")
const packageJsonPath = path.join(rootDir, "sources", "package.json")
if (!fs.existsSync(packageJsonPath)) {
  throw new Error("Can't find root package.json")
}
const yarnLockPath = path.join(rootDir, "sources", "yarn.lock")
if (!fs.existsSync(yarnLockPath)) {
  throw new Error("Can't find root yarn.lock")
}

const packageJson = JSON.parse(fs.readFileSync(packageJsonPath).toString())

const allDependencies = {
  ...packageJson.dependencies,
  ...packageJson.devDependencies,
}

const userVersionSpecifier = allDependencies["@kfs/fs"]

const yarnLockParseResult = lockfile.parse(
  fs.readFileSync(yarnLockPath).toString()
)

if (yarnLockParseResult.type === "error") {
  throw new Error("Can't parse user's yarn.lock file")
}

const resolution = yarnLockParseResult.object[`@kfs/fs@${userVersionSpecifier}`]

if (!resolution) {
  throw new Error("Can't find resolution for @kfs/fs")
}

const theirVersion = semver.parse(resolution.version)

if (!theirVersion) {
  throw new Error("Can't parse user version")
}

if (myVersion.major !== theirVersion.major) {
  throw new Error("Incompatible kfs versions. Try to update!")
}

const fsTarballPath = getPackageTarballPath(resolution)
if (!fsTarballPath) {
  throw new Error(
    `Can't find fs tarball path ${JSON.stringify(resolution, null, "  ")}`
  )
}

console.log("📂 Got @kfs/fs tarball:", fsTarballPath)
console.log("✨ Boostrap complete in", Date.now() - start + "ms")

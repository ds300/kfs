import tmp from "tmp"
import fs from "fs-extra"
import { join, basename, resolve } from "path"
import { spawnSync } from "child_process"

const fsDir = resolve(__dirname, "../../../fs")
if (!fs.existsSync(fsDir)) {
  throw new Error("Can't find fs dir")
}

const tmpDir = tmp.dirSync()

const baseDir = join(tmpDir.name, "sources")

fs.copySync(__dirname, baseDir)

fs.mkdirpSync(join(baseDir, "node_archives"))

const fsTarballs = fs
  .readdirSync(fsDir)
  .filter(name => name.startsWith("kfs-fs") && name.endsWith(".tgz"))

if (fsTarballs.length !== 1) {
  throw new Error("can't find single tarball in fs dir")
}

const tarballPath = join(baseDir, "node_archives", fsTarballs[0])

fs.copyFileSync(join(fsDir, fsTarballs[0]), tarballPath)

const addResult = spawnSync(
  "yarn",
  ["add", "file:./" + join("node_archives", fsTarballs[0])],
  {
    cwd: baseDir,
  }
)
if (addResult.status !== 0) {
  console.error({
    copiedOk: fs.existsSync(tarballPath),
    tarballPath,
    args: ["add", "file:./" + join("node_archives", fsTarballs[0])],
    cwd: baseDir
  })
  console.error(addResult.output.toString())
  throw new Error("failed to add fs tarball in tmp project")
}

describe(basename(__dirname), () => {
  it("is cool as heck", async () => {
    const result = spawnSync("node", [
      resolve(__dirname, "../../dist/instance.js"),
      tmpDir.name,
    ])
    console.log(result.output.toString())
  })
})

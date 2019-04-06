import { SourceDirectory, File, SourceFile } from "./Directory"
import { reactor, Derivable } from "./api"
import { promises } from "fs"

/**
 * i don't know what to do next
 *
 * What was the last thing you did?
 *
 * I got basic derived files working. No caching.
 *
 * Ok. What's the next thing that would make you feel like you're making progress.
 *
 * I want to compile a typescript project
 *
 * Alright, what's stopping you from doing that?
 *
 * The notion of a project doesn't exist yet.
 *
 * So implement the notion of a project?
 *
 * Hmm yeah. But. Like. How.
 *
 * What's in a project?
 *
 * The source tree. I know what that will look like already, with the derived files and all.
 * I need to implement custom resolution too. And basic stuff like getFile('path'), readFile('path'), makeFile('blah'), readJson('path'), readText('')
 *
 * Woah woah slow down.
 *
 */

describe(SourceDirectory, () => {
  it("can be created", () => {
    const dir = new SourceDirectory({
      sourcePath: process.cwd(),
      isDirectory: true,
      lastModified: 0,
    })

    expect(dir.name).toBe("data")
  })

  it("lists the files", async () => {
    const dir = new SourceDirectory({
      sourcePath: process.cwd(),
      isDirectory: true,
      lastModified: 0,
    })

    const entries = (await deref(dir.entries)).sort()

    expect(entries.map(n => n.name)).toMatchInlineSnapshot(`
Array [
  ".gitignore",
  ".prettierrc",
  "LICENSE",
  "dist",
  "jest.config.js",
  "node_modules",
  "package.json",
  "src",
  "tsconfig.json",
  "yarn-error.log",
]
`)
  })

  it("lists derived files", async () => {
    const dir = new SourceDirectory({
      sourcePath: process.cwd(),
      isDirectory: true,
      lastModified: 0,
    })

    const entries = (await deref(dir.entries)).sort()

    const srcEntries = await deref(
      (entries.filter(e => e.name === "src")[0] as SourceDirectory).entries,
    )

    expect(srcEntries.map(n => n.name)).toMatchInlineSnapshot(`
Array [
  ".derive.reverse.ts",
  "Directory.test.ts",
  "Directory.ts",
  "api.test.ts",
  "api.ts",
  "impl",
  "st.esrever.evired.",
  "st.tset.yrotceriD",
  "st.yrotceriD",
  "st.tset.ipa",
  "st.ipa",
]
`)

    const thisFileReversed = srcEntries.filter(
      f => f.name === "st.tset.yrotceriD",
    )[0] as File

    expect(await deref(thisFileReversed.text)).toBe(
      (await promises.readFile(__filename))
        .toString()
        .split("")
        .reverse()
        .join(""),
    )
  })

  it("lets you read files", async () => {
    const dir = new SourceDirectory({
      sourcePath: process.cwd(),
      isDirectory: true,
      lastModified: 0,
    })

    const entries = await deref(dir.entries)

    const packageJson = entries.filter(
      file => file.name === "package.json"
    )[0] as SourceFile

    const json = await deref(packageJson.json)

    expect(json).toMatchInlineSnapshot(`
Object {
  "dependencies": Object {},
  "devDependencies": Object {
    "@types/jest": "^24.0.11",
    "jest": "^24.3.1",
    "prettier": "^1.16.4",
    "ts-jest": "^24.0.0",
    "ts-node": "^8.0.3",
    "typescript": "^3.3.3333",
  },
  "files": Array [
    "dist",
  ],
  "license": "MIT",
  "main": "dist/api.js",
  "name": "@kfs/data",
  "publishConfig": Object {
    "access": "public",
  },
  "scripts": Object {
    "prepublishOnly": "tsc",
    "test": "jest",
  },
  "version": "0.0.1-0",
}
`)
  })
})

const deref = async <T>(derivable: Derivable<T>): Promise<T> => {
  return new Promise(resolve => {
    const r = reactor(use => {
      resolve(use(derivable))
    })
    r.start()
    r.stop()
  })
}

import { SourceDirectory, File } from "./Directory"
import { reactor, Derivable } from "./api"

describe(SourceDirectory, () => {
  it("can be created", () => {
    const dir = new SourceDirectory({
      diskPath: process.cwd(),
      isDirectory: true,
      lastModified: 0,
    })

    expect(dir.name).toBe("data")
  })

  it("lists the files", async () => {
    const dir = new SourceDirectory({
      diskPath: process.cwd(),
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

  it("lets you read files", async () => {
    const dir = new SourceDirectory({
      diskPath: process.cwd(),
      isDirectory: true,
      lastModified: 0,
    })

    const entries = await deref(dir.entries)

    const packageJson = entries.filter(
      file => file.name === "package.json",
    )[0] as File

    const json = await deref(packageJson.json)

    expect(json).toMatchInlineSnapshot(`
Object {
  "dependencies": Object {},
  "devDependencies": Object {
    "@types/jest": "^24.0.11",
    "jest": "^24.3.1",
    "prettier": "^1.16.4",
    "ts-jest": "^24.0.0",
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

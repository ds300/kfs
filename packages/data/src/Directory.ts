import {
  AsyncDerivable,
  SyncDerivable,
  MaybePromise,
  Derivable,
} from "./impl/types"
import * as path from "path"
import { atom, Store, derive } from "./api"
import { promises } from "fs"

export interface DirectoryEntry {
  readonly name: string
}
export interface File extends DirectoryEntry {
  readonly size: AsyncDerivable<number>
  readonly handle: AsyncDerivable<{ getBuffer(): Promise<Buffer> }>
  readonly text: AsyncDerivable<string>
}

export interface Directory extends DirectoryEntry {}

export namespace File {
  export function isFile(x: any): x is File {
    return x instanceof DerivedFile || x instanceof SourceFile
  }
  export function fromString(
    name: string,
    data: Derivable<MaybePromise<string>>,
  ): File {
    return new DerivedFile(
      name,
      derive(
        async use =>
          Buffer.from(await use(data as AsyncDerivable<string>)).length,
      ),
      derive(async use => {
        const text = await use(data as AsyncDerivable<string>)
        return {
          getBuffer: async () => Buffer.from(text),
        }
      }),
      derive(async use => await use(data as AsyncDerivable<string>)),
      derive(async use =>
        JSON.parse(await use(data as AsyncDerivable<string>)),
      ),
    )
  }
}

export class DerivedFile implements File {
  constructor(
    public readonly name: string,
    public readonly size: AsyncDerivable<number>,
    public readonly handle: AsyncDerivable<{ getBuffer(): Promise<Buffer> }>,
    public readonly text: AsyncDerivable<string>,
    public readonly json: AsyncDerivable<object>,
  ) {}
}

export class SourceFile implements File {
  readonly sourcePath: string
  readonly lastModified: Store<number>
  readonly name: string
  constructor(file: RawFileDescriptor) {
    this.sourcePath = file.sourcePath
    this.name = path.basename(file.sourcePath)
    this.lastModified = atom(file.lastModified)
  }
  readonly size = derive(async use => {
    use(this.lastModified)
    const { size } = await promises.stat(this.sourcePath)
    return size
  })
  readonly handle = derive(async use => {
    use(this.lastModified)
    return {
      getBuffer: () => promises.readFile(this.sourcePath),
    }
  })
  readonly text = derive(async use => {
    const handle = await use(this.handle)
    const buffer = await handle.getBuffer()
    return buffer.toString()
  })
  readonly json = derive(async use => {
    return JSON.parse(await use(this.text))
  })
  readonly require = derive(async use => {
    use(this.lastModified)
    return require(this.sourcePath.replace(/.ts$/, ""))
  })
}

interface RawFileDescriptor {
  sourcePath: string
  isDirectory: boolean
  lastModified: number
}

export class SourceDirectory implements Directory {
  private readonly sourcePath: string
  readonly name: string
  private readonly rawDirectoryListing: AsyncDerivable<RawFileDescriptor[]>
  private readonly lastModified: Store<number>
  constructor(rawDescriptor: RawFileDescriptor) {
    this.sourcePath = rawDescriptor.sourcePath
    this.name = path.basename(rawDescriptor.sourcePath)
    this.lastModified = atom(rawDescriptor.lastModified)
    this.rawDirectoryListing = derive(use => {
      use(this.lastModified)
      return promises.readdir(this.sourcePath).then(files => {
        return Promise.all(
          files.map(async fileName => {
            const stats = await promises.stat(
              path.join(this.sourcePath, fileName),
            )
            return {
              sourcePath: path.join(this.sourcePath, fileName),
              isDirectory: stats.isDirectory(),
              lastModified: stats.mtimeMs,
            }
          }),
        )
      })
    })
  }

  readonly rawEntries: AsyncDerivable<DirectoryEntry[]> = derive(async use => {
    const files = await use(this.rawDirectoryListing)

    const result = []

    for (const file of files) {
      if (file.isDirectory) {
        result.push(new SourceDirectory(file))
      } else {
        result.push(new SourceFile(file))
      }
    }

    return result
  })

  readonly derivedEntries = derive(async use => {
    const rawEntries = await use(this.rawEntries)
    const deriveFiles = rawEntries
      .filter(isSourceFile)
      .filter(f => f.name.match(/^\.derive\..*\.tsx?$/))

    const derivers: Array<
      (
        files: AsyncDerivable<DirectoryEntry[]>,
      ) => AsyncDerivable<DirectoryEntry[]>
    > = (await Promise.all(
      deriveFiles.map(f => use(f.require).then(m => m.transform)),
    )) as any

    return derivers.reduce((acc, deriver) => deriver(acc), this.rawEntries)
  })

  readonly entries = derive(use => use(this.derivedEntries).then(use))

  // readonly dirs: AsyncDerivable<Directory[]> = derive(use => {
  //   return use(this.rawDirectoryListing)
  //     .filter(stats => stats.isDirectory())
  //     .map()
  // })
  // readonly files: AsyncDerivable<File[]>
}
function isSourceFile(x: any): x is SourceFile {
  return x instanceof SourceFile
}

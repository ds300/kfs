import { AsyncDerivable, SyncDerivable } from "./impl/types"
import * as path from "path"
import { atom, Store, derive } from "./api"
import { promises } from "fs"

export class File {
  private readonly diskPath: string
  private readonly lastModified: Store<number>
  readonly name: string
  constructor(file: RawFileDescriptor) {
    this.diskPath = file.diskPath
    this.name = path.basename(file.diskPath)
    this.lastModified = atom(file.lastModified)
  }
  readonly size = derive(async use => {
    use(this.lastModified)
    const { size } = await promises.stat(this.diskPath)
    return size
  })
  readonly data = derive(async use => {
    use(this.lastModified)
    return promises.readFile(this.diskPath)
  })
  readonly text = derive(async use => {
    const data = await use(this.data)
    return data.toString()
  })
  readonly json = derive(async use => {
    const text = await use(this.text)
    return JSON.parse(text)
  })
}

interface RawFileDescriptor {
  diskPath: string
  isDirectory: boolean
  lastModified: number
}

export class SourceDirectory {
  private readonly diskPath: string
  readonly name: string
  private readonly rawDirectoryListing: AsyncDerivable<RawFileDescriptor[]>
  private readonly lastModified: Store<number>
  constructor(rawDescriptor: RawFileDescriptor) {
    this.diskPath = rawDescriptor.diskPath
    this.name = path.basename(rawDescriptor.diskPath)
    this.lastModified = atom(rawDescriptor.lastModified)
    this.rawDirectoryListing = derive(use => {
      use(this.lastModified)
      return promises.readdir(this.diskPath).then(files => {
        return Promise.all(
          files.map(async fileName => {
            const stats = await promises.stat(
              path.join(this.diskPath, fileName),
            )
            return {
              diskPath: fileName,
              isDirectory: stats.isDirectory(),
              lastModified: stats.mtimeMs,
            }
          }),
        )
      })
    })
  }

  readonly entries = derive(async use => {
    const files = await use(this.rawDirectoryListing)

    const result = []

    for (const file of files) {
      if (file.isDirectory) {
        result.push(new SourceDirectory(file))
      } else {
        result.push(new File(file))
      }
    }

    return result
  })
  // readonly dirs: AsyncDerivable<Directory[]> = derive(use => {
  //   return use(this.rawDirectoryListing)
  //     .filter(stats => stats.isDirectory())
  //     .map()
  // })
  // readonly files: AsyncDerivable<File[]>
}

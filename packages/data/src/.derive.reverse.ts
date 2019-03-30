import { AsyncDerivable } from "./impl/types"
import { DirectoryEntry } from "./Directory"
import { derive } from "./api"

export function transform(
  dirFiles: AsyncDerivable<DirectoryEntry[]>,
): AsyncDerivable<DirectoryEntry[]> {
  return derive(async use => {
    const files = await use(dirFiles)
    return files.concat(
      files.map(f => ({
        name: f.name
          .split("")
          .reverse()
          .join(""),
      })),
    )
  })
}

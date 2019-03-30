import { AsyncDerivable } from "./impl/types"
import { DirectoryEntry, File } from "./Directory"
import { derive } from "./api"

export function transform(
  dirFiles: AsyncDerivable<DirectoryEntry[]>,
): AsyncDerivable<DirectoryEntry[]> {
  return derive(async use => {
    const files = await use(dirFiles)
    return files.concat(
      files.filter(File.isFile).map(f => {
        return File.fromString(
          f.name
            .split("")
            .reverse()
            .join(""),
          derive(async use => {
            const text = await use(f.text)
            return text
              .split("")
              .reverse()
              .join("")
          }),
        )
      }),
    )
  })
}

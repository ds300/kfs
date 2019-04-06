import { resolve } from "path"

export function getPackageTarballPath({
  resolved,
}: {
  resolved?: string
}): string | null {
  if (!resolved) {
    return null
  }

  const hashIndex = resolved.lastIndexOf("#")
  if (hashIndex === -1) {
    throw new Error("Can't find checksum for tarball")
  }
  // TODO: support paths without file:
  if (resolved.startsWith("file:")) {
    // resolve relative to sources dir
    const tarballPath = resolved.slice("file:".length, hashIndex)
    // TODO: handle absolute paths
    return resolve(process.cwd(), "sources", tarballPath)
  }

  // TODO: support https
  return null
}

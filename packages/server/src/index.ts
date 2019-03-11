import { makeExecutableSchema } from "graphql-tools"
import { execute } from "graphql"
import { readFile } from "fs-extra"
import klaw from "klaw"
import { atom, derive } from "derivable"
import { isEqual } from "lodash"

function getAllFiles(dir: string) {
  return new Promise<string[]>((resolve, reject) => {
    const items: string[] = []
    klaw(dir)
      .on("error", reject)
      .on("end", () => resolve(items))
      .on("data", ({ path, stats }) =>
        stats.isDirectory ? null : items.push(path),
      )
  })
}

async function init() {
  const dir = process.argv[2]

  const files = atom(await getAllFiles(dir))

  const schema = makeExecutableSchema({
    typeDefs: (await readFile("./schema.graphql")).toString(),
    resolvers: {
      Query: {
        files: (_, args) => {
          return derive(() => {
            let fs = files.get()
            if (args.pathPrefix) {
              fs = fs.filter(filename => filename.startsWith(args.pathPrefix))
            }
          }).withEquality(isEqual)
        },
      },
    },
  })

  console.log(schema.getQueryType())
}

init()

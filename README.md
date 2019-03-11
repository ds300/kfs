# kfs

⚠️ This doesn't exist yet. It's in the design/prototyping stage. It's also crazy ambitious and might not ever exist. ⚠️

`kfs` is a file system abstraction designed for software developement. It is built around patterns used extensively in devloper tooling. By making those patterns fundamental we hope to improve the software devlopment process by reducing tooling complexity and improving performance.

The main patterns being included so far are:

- Managing derived files.

  Most projects have a notion of 'source files' and 'build aterfacts', with potentially many steps between the two. `kfs` aims to provide a way to define explicit and dynamic relationships between source and build, with powerful generic tools to facilitate robust incremental updates. `kfs` will keep things consistent and up-to-date in an on-demand (i.e. lazy) fashion. This should prevent the majority of cases where build tools recalculate things that don't actually need to be recalculated.

- Managing the lifecycles and inputs of processes that 'watch' files. Think `webpack-dev-server` et al.

- Extensible file resolution. Including resolving to dynamically-generated files/data.

- Version control. Not trying to reinvent the wheel, just to carve out a thin human-friendly interface for git.

The `k` in `kfs` doesn't stand for anything. The npm org name was free, the google space is quite empty, and it's easy to type. You can imagine it stands for 'kool' if you like.

## Why?

- Helping our tools play nicely with each other (through derived files and pluggable resolution logic)
- Making monorepos easier to work on (through fine-grained change tracking).
- Making CI much cheaper (through robust incremental builds).

## But incremental build tools are never robust, how will that work?

The incremental state management API will be designed from the ground up for generative testing and error reporting. They should come more-or-less for free. So no hard robustness guarantees, but as good as we can get while being pragmatic.

## But file systems take hundreds of person-years to implement.

`kfs` uses regular file systems under the hood. It will provide a graphql API for file system metadata and regular old HTTP for reading/writing bytes. It sits at the same abstraction level as a database like postgres.

## This is nuts I want to help

[@ me on twitter](https://twitter.com/djsheldrick) or [email me](d.j.sheldrick@gmail.com) with ideas or questions.
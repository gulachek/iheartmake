# esmakefile

esmakefile is a JavaScript build system inspired by Make. It's intended to provide the
power and flexibility of javascript for creating a cross-platform
make-like build system, consisting of buildable targets in a dependency
tree.

The primary goal of esmakefile is to provide lower level tools and concepts that
Make provides, only extending where the author deems useful. Hence the familiar
terminology of rules, targets, prerequisites, and recipes is used. It's expected
that higher level tools will be built on top of this system to make building projects
easier.

**Disclaimer**: if you want to use another build tool like gulp, grunt, or jake, then
please do so. They're great tools. The author likes the Make build system and thinks
that these tools have diverged from the paradigm in a few ways. It's ok to have different
tools that different people like.

## Build System Model

_This description is out of date and needs revision_

The build system is defined by two components

1. A target dependency tree
1. A filesystem

### Target Dependency Tree

At a high level, a target is something that can be built (like an object
file, generated by compiling a C++ source file) and has an associated
timestamp and unordered set of dependencies. Before a target can be
built, it's dependencies must be built, and if any of the dependencies
have a newer timestamp than the current target, then the current target
must be built.

### Filesystem

The filesystem is as you would expect: files and directories identified
by a unique path. Paths can take three forms:

1. source

   Source paths identify files that are part of a project's source tree
   which is committed to version control systems and manually written by
   a developer. **The build system should never modify these.** They are
   identified with relative paths to the root of the source tree.

1. build

   Build paths identify files that are generated by the build system.
   The build system may read these files as inputs for generating other
   build files. They are identified with relative paths to the root of
   the build tree.

1. external

   External paths identify files that are installed on the hosting
   system, but are not defined by the project source tree. An example
   would be if a C++ program uses `#include <iostream>`, the iostream
   header would be an external file to that project, since the project
   almost certainly assumes that the file was already installed on the
   system and the location may vary relative to the build system. **The
   build system should never modify these files.** External paths are
   identified with absolute paths on the hosting system.

## Scope

### Build Scripts

esmakefile targets creating a well defined and predictable build of a project.
If the developer automates generation of package files for distribution as
build outputs, these are appropriate. While it is appropriate for a developer
to generate install files for a package, **esmakefile does not target
installation itself.** If a package manager like `brew` is used which favors
source installs, the installer should run the esmakefile build script to
generate well-defined outputs and then install those outputs to expected
locations.

In terms of `make`, this is somewhat different than what you'll see in
many existing projects. Many installers run `./configure` followed by
`make install` when installing from source. For package managers like
chocolatey or apt, prebuilt binary packages are usually employed, so
`make install` doesn't really <u>make</u> sense. `make` should build the
project, and the installer can install the files where it wants without
the build needing to know anything about every possible target system.
Otherwise, the scope of the build system is too ambiguous and confusing.

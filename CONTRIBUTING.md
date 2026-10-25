# Contributing to java-skeleton

How this repository works and how to change it safely. For using the generator, see
[`README.md`](README.md).

## What this repo is

java-skeleton is a **project generator**, not a product application. It is implemented in Node;
the entry point is `bin/cli.js`. It produces projects from the templates in `templates/`: `spring-gradle` (types `edge`, `flow`,
`data` and `acl`) and `java-library` (type `lib`). The mapping from type to template is in
`templates/manifest.json`.

- Usage and flags: see [`README.md`](README.md).
- Log of changes and decisions: see [`DEVLOG.md`](DEVLOG.md).

## How templates work

Templates are rendered with Handlebars by `bin/cli.js`.

- **`.hbs` extension**: template files end in `.hbs`; the extension is removed in the generated output.
- **`{{packagePath}}` in directory names**: for example
  `templates/spring-gradle/src/main/java/{{packagePath}}/`. It is resolved to the package path
  (the `groupId` with `.` replaced by `/`).
- **An `.hbs` file that renders empty is not written.** This lets a file be optional by wrapping it
  in `{{#if}}`. No current template relies on it.
- **Files without `.hbs` are copied verbatim** (for example `gradlew` and `gradle-wrapper.jar`).
- **GitHub expressions are escaped**: Handlebars would render `${{ ... }}` (GitHub Actions) as empty, so
  templates write them as `$\{{ ... }}`; the backslash makes Handlebars output `{{ ... }}` literally.
- **Variables available to templates**: `groupId`, `artifactId`, `serviceName`, `shortName` (the `--name` value), `javaVersion` and
  `packagePath`. They are derived from the type, product and name (see `README.md`). The Java version
  is not an input: it is the `JAVA_VERSION` constant in `bin/cli.js`, the only place to change it.

## How to verify a change

Run these steps in order. Only a JDK is needed on the host (the Gradle wrapper is embedded in the
generated project; use JDK 25, the value of `JAVA_VERSION`).

1. Build the Docker image:
   ```bash
   docker build -t java-skeleton:dev .
   ```
2. Create a temporary directory for the generated projects:
   ```bash
   D=$(mktemp -d)
   ```
3. Generate a project from each affected variant with the image (non-interactive `--yes` mode):
   ```bash
   docker run --rm -u "$(id -u):$(id -g)" -v "$D:/work" java-skeleton:dev \
     --yes --type data --product gastos --name expense
   docker run --rm -u "$(id -u):$(id -g)" -v "$D:/work" java-skeleton:dev \
     --yes --type lib --name errors
   ```
4. Compile and verify each generated project:
   ```bash
   cd "$D/gastos-data-expense" && ./gradlew build
   cd "$D/lib-errors" && ./gradlew build
   ```

Rules:

- The image contains a copy of `templates/`. After changing a template, rebuild the image before
  generating; otherwise the old version is verified.
- Generated projects are created in a temporary directory, never inside this repository, and are
  never committed.
- The full verification is 2 variants, both generated and built when a shared aspect changes:
  one service type (`spring-gradle`, for example `data`) and `lib` (`java-library`, with publishing
  always on). Their folders differ, so they coexist in `$D`.
- A template is not considered verified until its generated project builds.

## Library publication and consumption (GitHub Packages)

- GitHub Packages is the publication repository of the `lib-*` libraries (`cl.pirca.lib.<name>`).
  `java-library/gradle/publish.gradle.hbs` publishes to it (repository `GitHubPackages`, URL
  `<registryUrl>/<artifactId>`) and still supports `publishToMavenLocal`.
- The registry base URL (host and owner) is written once per generated project: the
  `pirca.registryUrl` line of `gradle.properties` (one copy in each template). Both templates'
  `gradle/repositories.gradle` and `publish.gradle` read it with `project.property`, so switching
  to another registry (for example Artifactory) means changing that one line.
- Both templates' `gradle/repositories.gradle` declare `mavenCentral()` and a GitHub Packages
  repository (`<registryUrl>/*`) restricted to the group regex `cl\.pirca\.lib\..*`, so a build
  that uses no pirca lib needs no token.
- GitHub Packages asks for a token even to read. Credentials are read at build time from
  `GITHUB_ACTOR` / `GITHUB_TOKEN` or the Gradle properties `gpr.user` / `gpr.token`
  (`~/.gradle/gradle.properties`); they are never written in a template or a generated file.
  Scopes: `read:packages` to consume, `write:packages` to publish.
- Docker builds receive the token as a BuildKit secret, never as `ARG`/`ENV` (they persist in the
  image layers and history):

  ```bash
  docker build --secret id=github_actor,env=GITHUB_ACTOR --secret id=github_token,env=GITHUB_TOKEN .
  ```

  The generated service `ci/docker/Dockerfile` already does this: both Gradle steps
  (`dependencies` and `bootJar`) mount the secrets with `--mount=type=secret` and export
  `GITHUB_ACTOR` / `GITHUB_TOKEN` only when the secret file exists, so a build without secrets
  still works when no pirca lib is used. The `lib` template has no Dockerfile.

- Verifying a change needs no token: generated `data` and `lib` projects build without one.

## Generated CI workflow

Both templates carry `.github/workflows/ci.yml.hbs`, so every generated project (service or lib) has
`.github/workflows/ci.yml`. It runs `./gradlew build` (which includes `test`, `intTest` and `archTest`)
on every push to a branch and on every pull request to `main`, and nothing else. It uses the run's own
`GITHUB_TOKEN` with `packages: read` (plus `contents: read`) and passes `GITHUB_ACTOR` and
`GITHUB_TOKEN` to the build, so pirca libraries download from GitHub Packages with no secret added.
The Java version is `javaVersion` (`JAVA_VERSION` in `bin/cli.js`). Gradle dependencies are cached by
`gradle/actions/setup-gradle`, and a newer push to the same ref cancels the run in progress.

## Making a change

- Edit the templates under `templates/`. Change the generator code (`bin/cli.js`) only when the
  change is to the generator itself.
- Never edit or commit generated projects; they only exist in the temporary directory used for
  verification.
- Add an entry to `DEVLOG.md` for every change, following its format (what, why, verification).
- Update `README.md` only when usage, commands or flags change.

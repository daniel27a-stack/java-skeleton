# Contributing to java-skeleton

How this repository works and how to change it safely. For using the generator, see
[`README.md`](README.md).

## What this repo is

java-skeleton is the **pirca generator**, not a product application. It is implemented in Node;
the entry point is `bin/cli.js`. It asks for type, product (services only) and name, derives
Artifact ID, Group ID, package and output folder, and renders a template from `templates/`.
`templates/manifest.json` maps each type to a template: `edge`, `flow`, `data` and `acl` use
`spring-gradle`; `lib` uses `java-library`. The `java-app` template directory stays on disk but
is not offered.

- Usage and flags: see [`README.md`](README.md).
- Log of changes and decisions: see [`DEVLOG.md`](DEVLOG.md).

## How templates work

Templates are rendered with Handlebars by `bin/cli.js`.

- **`.hbs` extension**: template files end in `.hbs`; the extension is removed in the generated output.
- **`{{packagePath}}` in directory names**: for example
  `templates/spring-gradle/src/main/java/{{packagePath}}/`. It is resolved to the package path
  (the `groupId` with `.` replaced by `/`).
- **Optional files and blocks** can be controlled with `{{#if}}`.
- **An `.hbs` file that renders empty is not written.** There is no current example: libraries
  always include the publishing configuration (`gradle/publish.gradle`).
- **Files without `.hbs` are copied verbatim** (for example `gradlew` and `gradle-wrapper.jar`).
- **Variables available to templates**: `groupId`, `artifactId`, `serviceName`, `javaVersion`, `port`,
  `className` and `packagePath`. `{{className}}` is also used in file names
  (for example `{{className}}Application.java.hbs`).

## How to verify a change

Run these steps in order. Only a JDK is needed on the host (the Gradle wrapper is embedded in the
generated project; use JDK 25 for `--java 25`).

1. Build the Docker image:
   ```bash
   docker build -t java-skeleton:dev .
   ```
2. Create a temporary directory for the generated projects:
   ```bash
   D=$(mktemp -d)
   ```
3. Generate a project of each affected variant with the image (non-interactive `--yes` mode):
   ```bash
   docker run --rm -u "$(id -u):$(id -g)" -v "$D:/work" java-skeleton:dev \
     --yes --type data --product gastos --name expense
   ```
   Change `--type`, `--product` and `--name` for the other variants (see below).
4. Compile and verify the generated project:
   ```bash
   cd "$D/gastos-data-expense" && ./gradlew build
   ```

Rules:

- The image contains a copy of `templates/`. After changing a template, rebuild the image before
  generating; otherwise the old version is verified.
- Generated projects are created in a temporary directory, never inside this repository, and are
  never committed.
- The full verification is 3 variants, all generated and built when a shared aspect changes:
  a service (`--type data --product gastos --name expense`), a service with a hyphenated name
  (`--type flow --product gastos --name expense-claims`) and a library (`--type lib --name errors`).
  Their output folders (`gastos-data-expense`, `gastos-flow-expense-claims`, `lib-errors`) coexist in `$D`.
- A template is not considered verified until its generated project builds.

## Making a change

- Edit the templates under `templates/`. Change the generator code (`bin/cli.js`) only when the
  change is to the generator itself.
- Never edit or commit generated projects; they only exist in the temporary directory used for
  verification.
- Add an entry to `DEVLOG.md` for every change, following its format (what, why, verification).
- Update `README.md` only when usage, commands or flags change.

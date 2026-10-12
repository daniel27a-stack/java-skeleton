# java-skeleton

## What this repo is

java-skeleton is a **project generator**, not a product application. It is implemented in Node;
the entry point is `bin/cli.js`. It produces projects from the templates in `templates/`:
`spring-gradle`, `java-app` and `java-library` (registered in `templates/manifest.json`).

- Usage and flags: see [`README.md`](README.md).
- Log of changes and decisions: see [`DEVLOG.md`](DEVLOG.md).

## How templates work

Templates are rendered with Handlebars by `bin/cli.js`.

- **`.hbs` extension**: template files end in `.hbs`; the extension is removed in the generated output.
- **`{{packagePath}}` in directory names**: for example
  `templates/spring-gradle/src/main/java/{{packagePath}}/`. It is resolved to the package path
  (the `groupId` with `.` replaced by `/`).
- **Optional files and blocks** are controlled with `{{#if}}`.
- **An `.hbs` file that renders empty is not written.** This is how optional files with `{{#if}}` work.
  Example: `templates/java-library/gradle/publish.gradle.hbs` renders empty and is NOT written when
  the project is generated WITHOUT `--with-publish`; with `--with-publish` it is written.
- **Files without `.hbs` are copied verbatim** (for example `gradlew` and `gradle-wrapper.jar`).
- **Variables available to templates**: `groupId`, `artifactId`, `serviceName`, `javaVersion`, `port`,
  `withPublish`, `className` and `packagePath`. `{{className}}` is also used in file names
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
3. Generate a project from each affected template with the image (non-interactive `--yes` mode):
   ```bash
   docker run --rm -u "$(id -u):$(id -g)" -v "$D:/work" java-skeleton:dev \
     --yes --template spring-gradle --name demo --group com.acme --artifact demo-spring --java 25
   ```
   Change `--template` and `--artifact` for the other variants (see below).
4. Compile and verify the generated project:
   ```bash
   cd "$D/demo-spring" && ./gradlew build
   ```

Rules:

- The image contains a copy of `templates/`. After changing a template, rebuild the image before
  generating; otherwise the old version is verified.
- Generated projects are created in a temporary directory, never inside this repository, and are
  never committed.
- The full verification is 4 variants, all generated and built when a shared aspect changes:
  `spring-gradle`, `java-app`, `java-library` and `java-library` with `--with-publish`. Use a
  distinct `--artifact` for each so they coexist in `$D`.
- A template is not considered verified until its generated project builds.

## Scope for agents

- This is a generator, not a product application.
- Edit: the templates under `templates/`; generator code (`bin/cli.js`) only when the change is to
  the generator itself; and `README.md` and `DEVLOG.md`, which are updated in every change
  following their existing format.
- Do not touch: generated projects, and `bin/cli.js` unless the change is to the generator.
- Load the `pirca-conventions` skill before working.

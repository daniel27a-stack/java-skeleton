# java-skeleton devlog

Log of the steps taken on the generator, in order. Each entry states **what** changed,
**why**, and **how it was verified**. Architecture decisions for pirca (BC/MC/ACL/lib,
`cl.pirca` naming) are recorded elsewhere; this file covers the templates only.

## Template plan (defined 2026-10-10)

1. ✅ Spring Boot 4 + Java 25
2. ✅ Gradle split into `gradle/*.gradle`
3. ✅ `intTest` (WireMock) and `archTest` (ArchUnit) source sets
4. ⬜ Quality: SpotBugs + FindSecBugs, JaCoCo with threshold, manual PIT
5. ⬜ Actuator: liveness/readiness health + `/api/<artifact>/v1` routes
6. ✅ Multi-stage `Dockerfile` with Spring Boot layers
7. ✅ Spring library template (auto-configuration) for `lib-*`

## Template decisions

| Date | Decision | Why |
|---|---|---|
| 2026-10-10 | Java 25 + Spring Boot 4 by default | Current LTS; the reference work stack already migrated (see Step 1) |
| 2026-10-10 | Versions in the **Gradle version catalog** (`gradle/libs.versions.toml`), not `ext {}` variables | Functionally equivalent, but it also centralizes plugin versions, Dependabot/Renovate understand it and IntelliJ autocompletes it. Dependencies managed by the Spring Boot BOM are declared without a version |
| 2026-10-10 | Dependency update bot: **undecided** | Manual control preferred; to be decided once CI exists |
| 2026-10-11 | **Three layers**: `gradle/` (build and verify), `ci/` (deploy and run, e.g. `ci/docker/Dockerfile`), `.github/workflows/` (when to run) | The pipeline only calls Gradle tasks, so everything runs the same locally and in CI. The `ci/` name is kept from the reference work stack, even if it mostly holds deployment files |
| 2026-10-11 | Spring Boot BOM imported as a **Gradle `platform()`**; the `io.spring.dependency-management` plugin is no longer used | With the plugin, the BOM overrides native Gradle constraints. As a platform, `constraints { ... because(...) }` work for every dependency. Verified: same resolved dependencies as before |
| 2026-10-11 | Forced versions: **`constraints` + `because` by default**, `resolutionStrategy.eachDependency` only as an escape hatch | Constraints document the reason (visible in `dependencyInsight`); the escape hatch covers group-wide or conditional rules |
| 2026-10-11 | **Branching and releases**: `feature/ARQ-n` → PR → `main` → tag `vX.Y.Z`; no `develop` | Merging to `main` certifies (reviewed PR; green pipeline once CI exists), a tag publishes (`release.yml` runs on `v*`). `main` is protected: no direct or force pushes (admins included), linear history, squash merge only, branches deleted on merge. The repo was made public because GitHub Free does not protect private repos. Protection is a repository ruleset (`protect-main`, no bypass actors): classic branch protection with 0 required approvals still let the owner push directly |
| 2026-10-12 | **Three test suites** (`test`, `intTest`, `archTest`) with the JVM Test Suite plugin, all part of `check`, `test` first (`mustRunAfter`) | Separate source sets and tasks, each runnable alone. New suites do not see the main classes by default in Gradle 9, so they declare `implementation project()` |
| 2026-10-12 | One **general `ArchitectureTest`** (same source in all templates) for the ARQ-25 layers; layers a project lacks are opted out with `archTest.excludeLayers` in `gradle.properties` (unknown names fail the build) | Every layer rule is tagged `layer-<layer>` (`@ArchTag`), and the opt-out maps to JUnit `excludeTags`. `archRule.failOnEmptyShould=true` so a rule never passes silently on an empty layer. A "no package cycles" rule applies everywhere |
| 2026-10-22 | Inverse naming rules (suffix outside its layer package) use `allowEmptyShould(true)` | Each rule is tied to a suffix, so a project with no class of that suffix must still pass; the existing layer rules keep `failOnEmptyShould=true` |
| 2026-10-23 | Inverse naming rules no longer use `allowEmptyShould(true)` (supersedes the ARQ-29 row above) | An enabled layer with no class of its suffix must fail like every other layer rule, not pass silently. Layers a project does not have are opted out with `archTest.excludeLayers`; the template defaults still build |
| 2026-10-23 | **`java-library` (`lib`) is always a Spring Boot auto-configuration library**; no plain-Java variant. Its Spring Boot BOM is a `platform()` at the same version as `spring-gradle`, with no Boot plugin, so the jar stays a plain jar | The card requires `lib-*` libraries to activate by only adding the dependency. The generator has no flag for variants, so none is added |
| 2026-10-12 | **ArchUnit 1.5.1** and **`wiremock-standalone` 3.13.2** (spring-gradle `intTest` only) | The shaded WireMock jar has no transitive dependencies, so it cannot collide with the Spring Boot BOM (Jetty). 4.x is beta only |
| 2026-10-10 | **Everything inside the repo is written in English** (code, comments, docs, CLI messages, commits) | Standard for the repos; the Spanish texts were translated and `PLAN.md` was removed (it was a closed plan, still available in git history) |

---

## 2026-10-10 — Step 1: Spring Boot 4.1.1 + Java 25

**What:**
- `spring-gradle`: Spring Boot `3.5.16` → `4.1.1`.
  - `spring-boot-starter-web` → `spring-boot-starter-webmvc` (Boot 4 was modularized).
  - `spring-boot-starter-test` → `spring-boot-starter-webmvc-test` (brings `starter-test` + MockMvc).
  - `@WebMvcTest` moved to `org.springframework.boot.webmvc.test.autoconfigure`.
- `java-app` and `java-library`: JUnit BOM `5.11.4` → `6.1.3`.
- CLI: default Java `21` → `25` (17, 21 and 25 remain available).
- README: examples use `--java 25`.

**Why:** Java 25 is the current LTS (the next one is 29, Sept 2027) and the reference work
stack already moved to Java 25 + Spring Boot 4. A new project should not start one LTS behind.
Concrete benefits: final `ScopedValue` (candidate for `lib-tenant`), virtual threads without
pinning on `synchronized`, compact object headers, AOT cache.

**Unchanged:** Gradle wrapper stays at `9.5.1` (already supports Java 25).

**Local requirement:** JDK `25.0.4-tem` installed with SDKMAN, not set as default
(the default stays at 21). Gradle finds it through the toolchain.

**Verification:** `java-skeleton:dev` image rebuilt; the 3 templates generated with
`--java 25`, `./gradlew build` green (1/1 test each). `spring-gradle` starts in
~1.8 s and `GET /hello` responds. `java-library` passes `publishToMavenLocal`.

## 2026-10-10 — Repo translated to English

**What:** README, CLI (prompts, validation errors, help, comments), wrapper script,
Dockerfile, `package.json`, `manifest.json` labels and every template file (READMEs,
sample code, tests, comments) translated to English. Sample greetings are now
`Hello from <service>` / `Hello, world!`. CLI defaults: `my-service`, `com.example`.
`BITACORA.md` renamed to `DEVLOG.md`; `PLAN.md` removed.

## 2026-10-11 — Step 2: Gradle split into `gradle/*.gradle`

**What:** every template now generates a short `build.gradle` (plugins, group, version and
`apply from`) plus one file per concern:

| File | Purpose |
|---|---|
| `gradle/libs.versions.toml` | Version catalog (versions, libraries, plugins) |
| `gradle/repositories.gradle` | Where dependencies come from (private repos go here) |
| `gradle/java.gradle` | Toolchain, encoding (+ sources/javadoc jars in `java-library`) |
| `gradle/sources.gradle` | Extra source sets and their tasks (`intTest` and `archTest` since Step 3) |
| `gradle/dependencies.gradle` | Project dependencies |
| `gradle/constraints.gradle` | Forced versions, with commented examples of both mechanisms |
| `gradle/tests.gradle` | Test task configuration |
| `gradle/publish.gradle` | `java-library` only, generated only with `--with-publish` |

- `spring-gradle` imports the Spring Boot BOM with `platform(libs.spring.boot.bom)` instead of
  the `io.spring.dependency-management` plugin.
- CLI: a `.hbs` file that renders to blank text is skipped, so optional files can be wrapped
  in `{{#if flag}}`.

**Verification:**
- Resolved dependencies (compile/runtime/test classpaths) of the 3 templates compared against
  a baseline taken before the change: identical.
- `./gradlew build` green in all templates (and `java-library` with and without `--with-publish`);
  `publishToMavenLocal` works; `java-library` without the flag has no `publish.gradle`.
- `spring-gradle` jar starts in ~1.9 s and `GET /hello` responds.
- Constraint vs BOM: forcing `tomcat-embed-core` 11.0.26 over the BOM's 11.0.24 with a
  `constraint` wins and `dependencyInsight` shows the `because` reason; the `eachDependency`
  escape hatch aligns the whole `org.apache.tomcat.embed` group and also reports its reason.
- Control test with the previous setup (`io.spring.dependency-management` plugin): the same
  constraint asking for 11.0.26 is overridden back to 11.0.24 ("Selected by rule"). This is why
  that setup needs `ext['<lib>.version']` overrides, and why the plugin was dropped.

## 2026-10-12 — Step 3: `intTest` and `archTest` suites

**What:** every template has `test`, `intTest` and `archTest` suites (`src/test`, `src/intTest`,
`src/archTest`), declared in `gradle/sources.gradle`, wired in `gradle/tests.gradle` and with
dependencies in `gradle/dependencies.gradle`. `check` runs the three, `test` first. `spring-gradle`
gets a sample `HelloService` (the controller delegates to it) and a WireMock sample in `intTest`.
`archTest` enforces the layer convention and forbids package cycles; `gradle.properties` holds
`archTest.excludeLayers` (`repository,client` in `spring-gradle`; all four layers in `java-app` and
`java-library`). Main dependencies are unchanged.

**Verification:** `./gradlew clean check` green in the 4 variants (spring-gradle, java-app,
java-library with and without `--with-publish`); `compileClasspath` and `runtimeClasspath`
identical to the baseline taken before the change; layer filtering, unknown-layer error, empty-layer
failure and rule violations (business package, package cycle) checked on generated projects.

`publishToMavenLocal` works, `gradlew run` prints the greeting in `java-app`, and the
`spring-gradle` jar answers `GET /hello` as before. `check` runs `test` first even when the
tasks are requested in reverse order. WireMock is only on the `spring-gradle` `intTest` classpath.

## 2026-10-12 — ARQ-28: CONTRIBUTING.md with the generator context

**What:** added a root `CONTRIBUTING.md` so anyone changing this repository (person or agent) knows
what it is: a Node generator (`bin/cli.js`) that renders Handlebars templates (`.hbs`, `{{packagePath}}`
directory names, `{{#if}}` for optional files such as `publish.gradle` with `--with-publish`). It
covers how a change is verified (build the Docker image, generate each template, compile each
generated project with `./gradlew build`) and how to make a change. It points to `README.md` and
`DEVLOG.md` instead of repeating them. Documentation only: no generator, template or build change,
and `README.md` is unchanged.

**Verification:** `docker build` succeeded; the 4 variants (spring-gradle, java-app, java-library
with and without `--with-publish`) were generated with the steps written in the document and
`./gradlew build` was `BUILD SUCCESSFUL` in each (JDK 25.0.4). The generated trees are identical
(sha256) to the baseline taken before the change. Paths, flags and commands cited in the document
were checked against `bin/cli.js`, `templates/manifest.json` and the templates. The diff against
`origin/main` is only the new document (plus this entry).

**Changed in review:** the file was first written as `CLAUDE.md` with a "Scope for agents" section.
It was renamed to `CONTRIBUTING.md` (the standard name, recognized by GitHub, useful to people and
any agent) and keeps only facts about this repository; agent-specific rules belong to the
pirca-harness. The review also fixed one rule: `DEVLOG.md` gets an entry in every change, but
`README.md` changes only when usage, commands or flags change.

## 2026-10-15 — ARQ-32: pirca generator (type, product, name)

**What:** java-skeleton is now the pirca generator. It asks only for the type (`edge`, `flow`,
`data`, `acl`, `lib`), the product (services only) and the name, interactively or with
`--yes --type <t> --name <n> [--product <p>]`; besides those only `--help` and `--version` exist.
Folder, artifactId, groupId, package and serviceName are derived (`gastos`/`data`/`expense` gives
`gastos-data-expense`, `data-expense`, `cl.pirca.gastos`; `lib`/`errors` gives `lib-errors`,
`cl.pirca.lib.errors`). Removed: the flags `--template --group --artifact --java --port --dir
--with-publish` and the shortcuts, the questions that went with them, the success message, port
configuration (`server.port`, `localhost:<port>`), the `java-app` template, and the
`className`, `port` and `withPublish` template variables. The Java version is the `JAVA_VERSION`
constant in `bin/cli.js`. Services get `Application.java`, libs get `Example`, `ExampleTest` and
`ExampleIntTest`, every project starts at `1.0.0`, and libs always include `maven-publish`.
`manifest.json` maps the five types to their template; `package.json` description, `README.md` and
`CONTRIBUTING.md` were updated.

**Why:** the generator should ask for the three data that define a pirca artifact and nothing
else, so every artifact follows the same names and structure.

**Verification:** image rebuilt; `--yes` generation of `data`, `edge` and `lib` builds with
`./gradlew build` (service and lib also `check`) using JDK 25; `publishToMavenLocal` publishes
`lib-errors` 1.0.0; resolved `compileClasspath`, `runtimeClasspath`, `testRuntimeClasspath`,
`intTestRuntimeClasspath` and `archTestRuntimeClasspath` are identical to the baseline taken
before the change; invalid flags and values fail with exit 1 and no files; interactive mode
re-asks invalid values and Ctrl-C exits with 130 and no files.

**Unchanged:** dependencies and versions, `archTest.excludeLayers`, the Gradle wrapper, the
Dockerfile, `scripts/java-skeleton`, the release workflow and the `spring-gradle` example classes.

## 2026-10-22 — ARQ-29: inverse naming rules in archTest

**What:** the general `ArchitectureTest` (identical in the `spring-gradle` and `java-library`
templates) gains four inverse naming rules, one per layer: a top-level class named `*Controller`,
`*Service`, `*Repository` or `*Client` must live in the matching `..<layer>..` package (sub-packages
included). Each rule carries `@ArchTag("layer-<layer>")`, so `archTest.excludeLayers` opts it out
like the existing rules, and uses `allowEmptyShould(true)`. Matching is by suffix on top-level classes
(`UserServiceImpl` and nested classes such as `Outer.InnerController` are not affected). The existing
rules, their tags and the `gradle.properties` keys are unchanged. Both generated `README.md.hbs`
now describe the naming rules in both directions.

**Why:** the existing rules only checked classes already inside a layer package, so a
`StrayController` in the root package passed `archTest` (confirmed against the baseline).

**Verification:** image rebuilt, `data` and `lib` regenerated, `./gradlew build` and `archTest`
pass unmodified. A `StrayController` or `StrayService` in the root package of `data` now fails
`archTest` and the report names the class (baseline passed). With `excludeLayers` empty, a stray
class of each of the four suffixes fails its own rule. `UserService` in `..controller` fails;
`UserServiceImpl`, a nested `InnerController` and `FooController` in `controller.sub` pass.
`StrayClient` passes with `client` excluded (default) and the `lib` with a `StrayController`
passes (all layers excluded). The diff only adds rule blocks and one README sentence.

**Unchanged:** `CONTRIBUTING.md`, `gradle.properties`, `gradle/*.gradle`, dependencies.

## 2026-10-23 — ARQ-48: inverse naming rules fail on an empty layer

**What:** removed `.allowEmptyShould(true)` from the four inverse naming rules (`*Controller`,
`*Service`, `*Repository`, `*Client`) of the general `ArchitectureTest`, in both the `spring-gradle`
and `java-library` templates (the two files stay identical). This supersedes the ARQ-29 decision
that those rules use `allowEmptyShould(true)`.

**Why:** an enabled layer with no class of its suffix passed `archTest` silently, unlike every other
layer rule. Projects without a layer opt out through `archTest.excludeLayers`.

**Verification:** image rebuilt, `data` and `lib` regenerated; `./gradlew build archTest` (`data`)
and `./gradlew build` (`lib`) are successful unmodified. `data` with `excludeLayers=repository`
fails `clientClassesLiveInClientPackage`; with `excludeLayers=client` it fails
`repositoryClassesLiveInRepositoryPackage` (the baseline passed both). A `StrayController` or
`StrayService` in the root package fails its rule and passes once removed. `archTestRuntimeClasspath`
is identical to the baseline. Not run: a stray `StrayClient` with `excludeLayers` empty.

**Unchanged:** `README.md`, `CONTRIBUTING.md`, `gradle.properties`, `gradle/*.gradle`, dependencies.

## 2026-10-23 — ARQ-15: multi-stage Dockerfile with Spring Boot layers

**What:** `spring-gradle` projects (`edge`, `flow`, `data`, `acl`) now include
`ci/docker/Dockerfile` and a root `.dockerignore`. The Dockerfile has a JDK build stage (the
project's Gradle wrapper; build files are copied and dependencies resolved before `src/`, so the
dependency layer stays cached) and a JRE-only runtime stage that runs as the non-root user `app`
and copies the layers extracted with `-Djarmode=tools extract --layers` in separate `COPY`
instructions. The Java version in the base images comes from `javaVersion`
(`JAVA_VERSION` in `bin/cli.js`). New `gradle/packaging.gradle` names the `bootJar` `app.jar`.
Roadmap step 6 is marked done.

**Why:** a service must be deployable as a small, cache-friendly, non-root image, with the same
fixed jar name in every generated project.

**Verification:** image rebuilt; `data` and `lib` generated and built with `./gradlew build`
(both pass); `lib` has no Dockerfile or `.dockerignore`; the `data` `build/libs` holds `app.jar`
and `data-expense-1.0.0-plain.jar`; `docker build -f ci/docker/Dockerfile` succeeds; the
container runs as `app` (uid 999, `Config.User` = `app`), `/app` holds the extracted layout, and
`curl localhost:8080/hello` returns `Hello from gastos-data-expense`; after changing only a file
under `src/`, the rebuild reports the `dependencies` step as `CACHED`. Not run: `java -jar
build/libs/app.jar` on the host (host JDK is 21, the service is compiled for Java 25); the same
jar was started inside the container instead.

**Unchanged:** `bin/cli.js`, `manifest.json`, the `java-library` template, dependencies and
tests, the Gradle wrapper, CI workflows.

## 2026-10-23 — ARQ-16: Spring Boot auto-configuration library template

**What:** the `java-library` template (type `lib`) now generates a Spring Boot 4 auto-configuration
library instead of plain Java. `Example` and its tests are replaced by `LibraryAutoConfiguration`
(`@AutoConfiguration`), a `LibraryInfo` record bean with `@ConditionalOnMissingBean`, and
`META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports`, so adding the
dependency to a Spring Boot application is enough to activate it. Spring Boot `4.1.1` (same as
`spring-gradle`) is imported as a Gradle `platform()`, without the Spring Boot plugin, so the
artifact stays a plain jar; the separate `junit-bom` is dropped (the Boot BOM manages JUnit). A unit
test checks the bean, and an `intTest` uses `ApplicationContextRunner` to check activation, the
consumer override and the `.imports` file. Roadmap step 7 is marked done; the root `README.md`
table and the template `README.md.hbs` describe the new kind of library.

**Why:** the `lib-*` libraries must be usable by only adding the dependency, with no `@Import` or
`@ComponentScan` in the consumer.

**Verification:** image rebuilt; `lib-errors` generated and `./gradlew build` passes (test 1, intTest 3,
archTest 1 tests, 0 failures); the jar holds the `.imports` file and the classes at its root, no
`BOOT-INF/`; the published POM imports the Boot BOM. After `publishToMavenLocal` (writes to
`~/.m2`), a generated `data` project with the library as a dependency autowires `LibraryInfo`
without any `@Import` in a `@SpringBootTest` (temporary copy, not committed). Controls: a wrong FQCN in the
`.imports` file fails `intTest`; `archTest.excludeLayers=bogus` fails with "unknown layer" and an
empty list fails `archTest`. `data` builds and its `runtimeClasspath` is identical to the baseline.

**Unchanged:** `bin/cli.js`, `manifest.json`, `spring-gradle`, generator inputs, publishing.

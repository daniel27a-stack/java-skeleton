# java-skeleton devlog

Log of the steps taken on the generator, in order. Each entry states **what** changed,
**why**, and **how it was verified**. Architecture decisions for pirca (BC/MC/ACL/lib,
`cl.pirca` naming) are recorded elsewhere; this file covers the templates only.

## Template plan (defined 2026-10-10)

1. ✅ Spring Boot 4 + Java 25
2. ✅ Gradle split into `gradle/*.gradle`
3. ⬜ `intTest` (WireMock) and `archTest` (ArchUnit) source sets
4. ⬜ Quality: SpotBugs + FindSecBugs, JaCoCo with threshold, manual PIT
5. ⬜ Actuator: liveness/readiness health + `/api/<artifact>/v1` routes
6. ⬜ Multi-stage `Dockerfile` with Spring Boot layers
7. ⬜ Spring library template (auto-configuration) for `lib-*`

## Template decisions

| Date | Decision | Why |
|---|---|---|
| 2026-10-10 | Java 25 + Spring Boot 4 by default | Current LTS; the reference work stack already migrated (see Step 1) |
| 2026-10-10 | Versions in the **Gradle version catalog** (`gradle/libs.versions.toml`), not `ext {}` variables | Functionally equivalent, but it also centralizes plugin versions, Dependabot/Renovate understand it and IntelliJ autocompletes it. Dependencies managed by the Spring Boot BOM are declared without a version |
| 2026-10-10 | Dependency update bot: **undecided** | Manual control preferred; to be decided once CI exists |
| 2026-10-11 | **Three layers**: `gradle/` (build and verify), `ci/` (deploy and run, e.g. `ci/docker/Dockerfile`), `.github/workflows/` (when to run) | The pipeline only calls Gradle tasks, so everything runs the same locally and in CI. The `ci/` name is kept from the reference work stack, even if it mostly holds deployment files |
| 2026-10-11 | Spring Boot BOM imported as a **Gradle `platform()`**; the `io.spring.dependency-management` plugin is no longer used | With the plugin, the BOM overrides native Gradle constraints. As a platform, `constraints { ... because(...) }` work for every dependency. Verified: same resolved dependencies as before |
| 2026-10-11 | Forced versions: **`constraints` + `because` by default**, `resolutionStrategy.eachDependency` only as an escape hatch | Constraints document the reason (visible in `dependencyInsight`); the escape hatch covers group-wide or conditional rules |
| 2026-10-11 | **Branching and releases**: `feature/ARQ-n` → PR → `main` → tag `vX.Y.Z`; no `develop` | Merging to `main` certifies (reviewed PR; green pipeline once CI exists), a tag publishes (`release.yml` runs on `v*`). `main` is protected: no direct or force pushes (admins included), linear history, squash merge only, branches deleted on merge. The repo was made public because GitHub Free does not protect private repos |
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
| `gradle/sources.gradle` | Extra source sets and their tasks (filled in Step 3) |
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

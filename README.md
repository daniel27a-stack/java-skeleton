# java-skeleton

Project skeleton generator for **Java + Gradle**. Three templates:

| Template        | Gradle plugin                | Purpose                          |
|-----------------|------------------------------|----------------------------------|
| `spring-gradle` | `org.springframework.boot`   | Spring Boot REST service         |
| `java-app`      | `application`                | Executable app / CLI tool        |
| `java-library`  | `java-library`               | Reusable library                 |

The generated project ships with the **Gradle wrapper embedded**, so it builds with
`./gradlew build` without Gradle installed (only a JDK is needed).

---

## Usage with Docker (no Node required)

```bash
docker run --rm -it \
  -u "$(id -u):$(id -g)" \
  -v "$PWD:/work" -w /work \
  ghcr.io/daniel27a-stack/java-skeleton
```

- `-it` → interactive prompts.
- `-u "$(id -u):$(id -g)"` → generated files are owned by your user, not `root`.
- `-v "$PWD:/work"` → the project appears in your current folder.

Non-interactive mode:

```bash
docker run --rm -u "$(id -u):$(id -g)" -v "$PWD:/work" -w /work \
  ghcr.io/daniel27a-stack/java-skeleton \
  --yes --template java-library --name my-lib --group com.acme --artifact my-lib --java 25 --with-publish
```

### Short alias

Copy `scripts/java-skeleton` to `~/.local/bin/` and then:

```bash
java-skeleton --template spring-gradle
```

---

## Usage with npx / npm (requires Node >= 20)

```bash
npm create java-service@latest
# or
npx java-skeleton
```

---

## Flags

| Flag                     | Description                                       |
|--------------------------|---------------------------------------------------|
| `-t, --template <id>`    | `spring-gradle` \| `java-app` \| `java-library`   |
| `-n, --name <name>`      | Project name                                      |
| `-g, --group <groupId>`  | Group id, e.g. `com.example`                      |
| `-a, --artifact <id>`    | Artifact id (name of the output folder)           |
| `-j, --java <version>`   | `17` \| `21` \| `25` (default `25`)               |
| `-p, --port <port>`      | Port (`spring-gradle` only)                       |
| `--with-publish`         | Include `maven-publish` (`java-library` only)     |
| `-d, --dir <path>`       | Base directory where the project is created       |
| `-y, --yes`              | Do not prompt; use defaults for anything missing  |

---

## Generated project: test suites

Every template generates three test suites, all run by `./gradlew check` (`test` first) and
each runnable alone:

| Suite      | Directory      | Command              |
|------------|----------------|----------------------|
| `test`     | `src/test`     | `./gradlew test`     |
| `intTest`  | `src/intTest`  | `./gradlew intTest`  |
| `archTest` | `src/archTest` | `./gradlew archTest` |

`spring-gradle` includes WireMock in `intTest`. `archTest` (ArchUnit) enforces the
`controller -> service -> repository | client` layers; a layer the project does not have is
opted out with `archTest.excludeLayers` in `gradle.properties`, and each layer rule is tagged
`layer-<layer>`.

---

## Development

Everything can be done without a local Node install, using throwaway containers:

```bash
# Regenerate the lockfile
docker run --rm -v "$PWD":/app -w /app node:22-alpine npm install --package-lock-only

# Build the image
docker build -t java-skeleton:dev .

# Try it
D=$(mktemp -d)
docker run --rm -u "$(id -u):$(id -g)" -v "$D:/work" java-skeleton:dev \
  --yes --template spring-gradle --name demo --group com.acme --artifact demo --java 25
cd "$D/demo" && ./gradlew build
```

Publishing (image to GHCR + package to npm) runs through `.github/workflows/release.yml`
when a `v*` tag is pushed.

See [`DEVLOG.md`](DEVLOG.md) for the log of changes and decisions.

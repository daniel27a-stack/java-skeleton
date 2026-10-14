# java-skeleton

**pirca generator** for Java + Gradle projects. It asks only for the artifact **type**, the
**product** (services only) and the **name**; Artifact ID, Group ID, Java package and output
folder are derived (see [pirca conventions](#derived-names)).

| Type                           | Template        | Gradle plugin              | Purpose                  |
|--------------------------------|-----------------|----------------------------|--------------------------|
| `edge`, `flow`, `data`, `acl`  | `spring-gradle` | `org.springframework.boot` | Spring Boot REST service |
| `lib`                          | `java-library`  | `java-library`             | Reusable library (always with `maven-publish`) |

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
  --yes --type data --product gastos --name expense
```

A library takes no product:

```bash
docker run --rm -u "$(id -u):$(id -g)" -v "$PWD:/work" -w /work \
  ghcr.io/daniel27a-stack/java-skeleton \
  --yes --type lib --name errors
```

### Short alias

Copy `scripts/java-skeleton` to `~/.local/bin/` and then:

```bash
java-skeleton --type flow --product gastos --name expense-claims
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

| Flag                   | Description                                                        |
|------------------------|--------------------------------------------------------------------|
| `-t, --type <type>`    | `edge` \| `flow` \| `data` \| `acl` \| `lib`                        |
| `--product <product>`  | Product, e.g. `gastos` (services only; rejected for `lib`; no short flag) |
| `-n, --name <name>`    | Artifact name, e.g. `expense`                                      |
| `-j, --java <version>` | `17` \| `21` \| `25` (default `25`, never prompted)                |
| `-p, --port <port>`    | Port (services only; default `8080`, never prompted)              |
| `-d, --dir <path>`     | Base directory where the project is created                        |
| `-y, --yes`            | Do not prompt; `--type`, `--name` and `--product` (services) are required |

Formats: product `^[a-z][a-z0-9]*$` (no hyphens); service name `^[a-z][a-z0-9]*(-[a-z0-9]+)*$`
(hyphens allowed); lib name `^[a-z][a-z0-9]*$` (no hyphens). Invalid or missing input fails
with a message and creates nothing.

### Derived names

| Value               | Services (`edge`, `flow`, `data`, `acl`) | `lib`                  |
|---------------------|------------------------------------------|------------------------|
| Artifact ID         | `<type>-<name>` (`data-expense`)         | `lib-<name>`           |
| Group ID = package  | `cl.pirca.<product>`                     | `cl.pirca.lib.<name>`  |
| Output folder       | `<product>-<type>-<name>` (`gastos-data-expense`) | `lib-<name>`  |

The Gradle project name is the Artifact ID, not the folder name.


---

## Generated project: test suites

Every generated project has three test suites, all run by `./gradlew check` (`test` first) and
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
  --yes --type data --product gastos --name expense
cd "$D/gastos-data-expense" && ./gradlew build
```

Publishing (image to GHCR + package to npm) runs through `.github/workflows/release.yml`
when a `v*` tag is pushed.

See [`DEVLOG.md`](DEVLOG.md) for the log of changes and decisions.

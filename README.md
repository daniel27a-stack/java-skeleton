# java-skeleton

Generator of **pirca** projects (Java + Gradle). It asks only for the artifact type, the product
and the name, and derives everything else. Five types:

| Type                          | Template        | Purpose                          |
|-------------------------------|-----------------|----------------------------------|
| `edge`, `flow`, `data`, `acl` | `spring-gradle` | Spring Boot REST service         |
| `lib`                         | `java-library`  | Reusable library                 |

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

### Short alias

Copy `scripts/java-skeleton` to `~/.local/bin/` and then:

```bash
java-skeleton
# or, without prompts
java-skeleton --yes --type lib --name errors
```

---

## Usage with npx / npm (requires Node >= 20)

```bash
npm create java-service@latest
# or
npx java-skeleton
```

---

## Usage

There are two modes, never mixed.

- **Interactive** (no flags): asks the type (a menu with `edge`, `flow`, `data`, `acl`, `lib`),
  then the product (services only, not for `lib`), then the name. An invalid value is asked again.
- **Non-interactive**: `--yes --type <type> --name <name> [--product <product>]`. `--product` is
  required for `edge`, `flow`, `data` and `acl`, and not allowed for `lib`. Passing `--type`,
  `--name` or `--product` without `--yes` is an error.

Besides those, only `--help` and `--version` exist.

| Input     | Pattern                                | Example          |
|-----------|----------------------------------------|------------------|
| product   | `^[a-z][a-z0-9]*$`                     | `gastos`         |
| name (service) | `^[a-z][a-z0-9]*(-[a-z0-9]+)*$`   | `expense-claims` |
| name (`lib`)   | `^[a-z][a-z0-9]*$`                | `errors`         |

Everything else is derived. The project is created in the current directory and the generator
fails if the folder already exists.

| Type                          | Folder                       | Artifact            | Group and package        |
|-------------------------------|------------------------------|---------------------|--------------------------|
| `edge`, `flow`, `data`, `acl` | `<product>-<type>-<name>`    | `<type>-<name>`     | `cl.pirca.<product>`     |
| `lib`                         | `lib-<name>`                 | `lib-<name>`        | `cl.pirca.lib.<name>`    |

Every project starts at version `1.0.0`. Services get an `Application` main class and libs get
`Example` classes and Maven publishing (`publishToMavenLocal`).

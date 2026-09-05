# java-skeleton

Generador de esqueletos de proyectos **Java + Gradle**. Tres templates:

| Template        | Plugin Gradle                | Para qué                         |
|-----------------|------------------------------|----------------------------------|
| `spring-gradle` | `org.springframework.boot`   | Servicio REST Spring Boot        |
| `java-app`      | `application`                | App / herramienta CLI ejecutable |
| `java-library`  | `java-library`               | Librería reutilizable            |

El proyecto generado trae el **Gradle wrapper embebido**, así que se compila con
`./gradlew build` sin necesidad de tener Gradle instalado (solo un JDK).

---

## Uso con Docker (no requiere Node)

```bash
docker run --rm -it \
  -u "$(id -u):$(id -g)" \
  -v "$PWD:/work" -w /work \
  ghcr.io/daniel27a-stack/java-skeleton
```

- `-it` → prompts interactivos.
- `-u "$(id -u):$(id -g)"` → los archivos generados quedan con tu usuario, no como `root`.
- `-v "$PWD:/work"` → el proyecto aparece en tu carpeta actual.

Modo no interactivo:

```bash
docker run --rm -u "$(id -u):$(id -g)" -v "$PWD:/work" -w /work \
  ghcr.io/daniel27a-stack/java-skeleton \
  --yes --template java-library --name mi-lib --group com.acme --artifact mi-lib --java 21 --with-publish
```

### Alias corto

Copiá `scripts/java-skeleton` a `~/.local/bin/` y luego:

```bash
java-skeleton --template spring-gradle
```

---

## Uso con npx / npm (requiere Node >= 20)

```bash
npm create java-service@latest
# o
npx java-skeleton
```

---

## Flags

| Flag                     | Descripción                                        |
|--------------------------|---------------------------------------------------|
| `-t, --template <id>`    | `spring-gradle` \| `java-app` \| `java-library`   |
| `-n, --name <nombre>`    | Nombre del proyecto                               |
| `-g, --group <groupId>`  | Group id, ej: `com.empresa`                       |
| `-a, --artifact <id>`    | Artifact id (nombre de la carpeta de salida)      |
| `-j, --java <version>`   | `17` \| `21` \| `25`                              |
| `-p, --port <puerto>`    | Puerto (solo `spring-gradle`)                     |
| `--with-publish`         | Incluir `maven-publish` (solo `java-library`)     |
| `-d, --dir <ruta>`       | Directorio base donde crear el proyecto           |
| `-y, --yes`              | No preguntar; usar defaults para lo que falte     |

---

## Desarrollo

Todo se puede hacer sin Node local, vía contenedores descartables:

```bash
# Regenerar el lockfile
docker run --rm -v "$PWD":/app -w /app node:22-alpine npm install --package-lock-only

# Construir la imagen
docker build -t java-skeleton:dev .

# Probar
D=$(mktemp -d)
docker run --rm -u "$(id -u):$(id -g)" -v "$D:/work" java-skeleton:dev \
  --yes --template spring-gradle --name demo --group com.acme --artifact demo --java 21
cd "$D/demo" && ./gradlew build
```

Publicación (imagen a GHCR + paquete a npm) vía `.github/workflows/release.yml` al
pushear un tag `v*`.

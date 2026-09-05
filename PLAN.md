# Plan — Scaffolder Java + Gradle (Docker + npm)

> **Estado: IMPLEMENTADO** (2026-09-04). Los 3 templates generan y compilan
> (`./gradlew build` en verde, 1 test cada uno). Imagen `java-skeleton:dev` construida
> y probada localmente. Falta: `git commit` inicial y la publicación real a GHCR + npm
> (fase 2, requiere `npm login` / push de tag).

## Contexto

Se quiere un generador de proyectos **Java + Gradle** (estilo `npx create-react-app`)
que un desarrollador pueda ejecutar **sin tener Node instalado**. En esta máquina
(ThinkPad nuevo) no hay Node ni npm; sí hay **Docker 29.7.2**, **JDK 21** y **Gradle 9.5.1**.

Ya existe una implementación parcial en este mismo directorio:

- `bin/cli.js` — CLI ESM con commander + inquirer + handlebars + fs-extra. Lógica de
  render completa (compila `.hbs`, sustituye `{{packagePath}}` en nombres de carpeta,
  copia a `./<artifactId>`).
- `templates/spring-gradle/` — template mínimo de servicio REST Spring Boot: `build.gradle`,
  `settings.gradle`, `application.yml`, `Application.java`, `HelloController.java`, `.gitignore`
  (todos `.hbs`).
- `package.json` — tiene `bin` y `type: module`, pero incompleto para publicar.

**Resultado buscado:** un solo repo que produce **dos canales de distribución**:

1. **Imagen Docker** (canal principal) — `docker run ...`, no requiere Node en el host.
2. **Paquete npm** — `npm create java-service` / `npx java-skeleton`, para quien sí tiene Node.

Ambos comparten `bin/` + `templates/`.

---

## Decisiones abiertas (need input antes de ejecutar)

| # | Decisión | Recomendación |
|---|---|---|
| 1 | Nombre del paquete npm | `java-skeleton` (sin scope) — habilita `npm create java-service`. Alt: `@daniel27a-stack/java-skeleton` |
| 2 | Ruta de la imagen | `ghcr.io/<usuario-github>/java-skeleton` — confirmar usuario de GitHub |
| 3 | Versión de Gradle a embeber en el wrapper | `8.14.x` (compatibilidad amplia). Alt: `9.x` para igualar tu local |
| 4 | `git init` en este repo ahora | Sí (hoy no es repo git) |
| 5 | Workflow de release (GitHub Actions) | Dejarlo escrito pero marcado como fase 2; publicar a mano la primera vez |
| 6 | Versión de Spring Boot en el template | `3.5.x` (subir desde el `3.3.0` actual) |
| 7 | `java-library`: ¿incluir `maven-publish` preconfigurado? | Sí, comentado/activable por flag `--with-publish` |
| 8 | Usuario de GitHub para `ghcr.io/<usuario>/...` y `repository` | pendiente de confirmar |

---

## Estructura objetivo del repo

```
java-skeleton/
├── bin/cli.js                     # actualizado (ver "Cambios al CLI")
├── templates/
│   ├── manifest.json              # NUEVO — metadata de templates (3 entradas)
│   ├── spring-gradle/             # COMPLETAR el existente
│   │   ├── build.gradle.hbs       # → toolchain + Spring Boot 3.5.x
│   │   ├── settings.gradle.hbs
│   │   ├── application.yml.hbs
│   │   ├── .gitignore.hbs         # ampliar (IDE, !gradle-wrapper.jar)
│   │   ├── README.md.hbs          # NUEVO
│   │   ├── gradlew  gradlew.bat   # NUEVO — wrapper embebido
│   │   ├── gradle/wrapper/gradle-wrapper.{jar,properties}   # NUEVO
│   │   └── src/
│   │       ├── main/java/{{packagePath}}/Application.java.hbs
│   │       ├── main/java/{{packagePath}}/controller/HelloController.java.hbs
│   │       └── test/java/{{packagePath}}/HelloControllerTest.java.hbs   # NUEVO
│   ├── java-app/                  # NUEVO — app / CLI ejecutable
│   │   ├── build.gradle.hbs       # plugins: java, application; JUnit 5 (junit-bom)
│   │   ├── settings.gradle.hbs
│   │   ├── .gitignore.hbs
│   │   ├── README.md.hbs
│   │   ├── gradlew  gradlew.bat  gradle/wrapper/*
│   │   └── src/
│   │       ├── main/java/{{packagePath}}/Main.java.hbs      # main()
│   │       ├── main/java/{{packagePath}}/Greeter.java.hbs
│   │       └── test/java/{{packagePath}}/GreeterTest.java.hbs
│   └── java-library/              # NUEVO — librería reutilizable
│       ├── build.gradle.hbs       # plugins: java-library (+ maven-publish opcional)
│       ├── settings.gradle.hbs
│       ├── .gitignore.hbs
│       ├── README.md.hbs
│       ├── gradlew  gradlew.bat  gradle/wrapper/*
│       └── src/
│           ├── main/java/{{packagePath}}/{{className}}.java.hbs   # API pública
│           └── test/java/{{packagePath}}/{{className}}Test.java.hbs
├── Dockerfile                     # NUEVO
├── .dockerignore                  # NUEVO
├── package.json                   # actualizado
├── package-lock.json              # NUEVO (generado vía contenedor, sin Node local)
├── README.md                      # NUEVO — uso docker + npx
├── LICENSE                        # NUEVO
└── .github/workflows/release.yml  # NUEVO (fase 2)
```

---

## Cambios al CLI (`bin/cli.js`)

1. **Selección de template**: leer `templates/manifest.json` y preguntar cuál usar
   (`spring-gradle` | `java-app` | `java-library`).
2. **Prompts por template**: spring pide `port`; java-library pide (si se activa)
   `withPublish`. El resto (`serviceName`, `groupId`, `artifactId`, `javaVersion`)
   es común.
3. **Modo no interactivo** (necesario para Docker sin TTY y para CI): flags
   `--template --name --group --artifact --java --port --with-publish --yes`.
   Si falta un dato y `--yes` está, usar default; si no, preguntar.
4. **Validación de entradas**:
   - groupId: `^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$`
   - artifactId: `^[a-z][a-z0-9-]+$`
   - javaVersion: uno de `17`, `21`, `25`
5. **`chmod 0o755` sobre `gradlew`** después de copiar (npm y Docker pueden perder el bit +x).
6. **Versión dinámica**: leer `version` desde `package.json` en lugar de hardcodear.
7. Mantener render Handlebars, strip de `.hbs`, sustitución `{{packagePath}}` (ya funcionan).
8. Mensaje final: `cd <artifactId> && ./gradlew build`.

Opcional: extraer helpers a `lib/` (`render.js`, `validate.js`) si `cli.js` crece mucho.

---

## Templates

### `spring-gradle` (completar el existente)

- `build.gradle.hbs`: cambiar `sourceCompatibility = JavaVersion.VERSION_{{javaVersion}}`
  por **toolchain** (robusto ante "17.0" o "1.8"):
  ```groovy
  java { toolchain { languageVersion = JavaLanguageVersion.of({{javaVersion}}) } }
  ```
  Subir Spring Boot a `3.5.x` y `io.spring.dependency-management` a la versión par.
- `HelloControllerTest.java.hbs`: `@SpringBootTest(webEnvironment = RANDOM_PORT)` +
  `TestRestTemplate`, o `@WebMvcTest` + `MockMvc`. Verifica `GET /hello`.
- `README.md.hbs`: cómo correr (`./gradlew bootRun`), puerto, endpoint.
- `.gitignore.hbs`: agregar `.idea/`, `*.iml`, `.vscode/`, `!gradle/wrapper/gradle-wrapper.jar`.
- Wrapper embebido (ver abajo).

### `java-app` (nuevo) — app / CLI ejecutable

- `build.gradle.hbs`:
  ```groovy
  plugins { id 'java'; id 'application' }
  group = '{{groupId}}'
  version = '0.0.1-SNAPSHOT'
  java { toolchain { languageVersion = JavaLanguageVersion.of({{javaVersion}}) } }
  repositories { mavenCentral() }
  dependencies {
      testImplementation platform('org.junit:junit-bom:5.11.3')
      testImplementation 'org.junit.jupiter:junit-jupiter'
  }
  application { mainClass = '{{groupId}}.Main' }
  tasks.named('test') { useJUnitPlatform() }
  ```
- `Main.java` con `public static void main`, `Greeter.java` con lógica trivial,
  `GreeterTest.java` con un `@Test` JUnit 5.
- Wrapper embebido. `./gradlew run` funciona out of the box.

### `java-library` (nuevo) — librería reutilizable

- `build.gradle.hbs`:
  ```groovy
  plugins {
      id 'java-library'
      {{#if withPublish}}id 'maven-publish'{{/if}}
  }
  group = '{{groupId}}'
  version = '0.1.0'
  java {
      toolchain { languageVersion = JavaLanguageVersion.of({{javaVersion}}) }
      withSourcesJar()
      withJavadocJar()
  }
  repositories { mavenCentral() }
  dependencies {
      // api '...'            // se expone a los consumidores
      // implementation '...' // interno
      testImplementation platform('org.junit:junit-bom:5.11.3')
      testImplementation 'org.junit.jupiter:junit-jupiter'
  }
  tasks.named('test') { useJUnitPlatform() }
  {{#if withPublish}}
  publishing {
      publications {
          maven(MavenPublication) { from components.java }
      }
      // repositories { maven { url = uri(...) } }  // GitHub Packages / Nexus / etc.
  }
  {{/if}}
  ```
- `{{className}}.java` con un método público de ejemplo (la API),
  `{{className}}Test.java` con un `@Test` JUnit 5.
- Sin `application` plugin, sin `main()`.
- Wrapper embebido.
- Decisión #7: `withPublish` se activa con `--with-publish` o respondiendo el prompt.

### Wrapper de Gradle (ambos templates)

Generar una sola vez por template, dentro de cada carpeta:

```
gradle wrapper --gradle-version 8.14.3
```

Commitear los 4 archivos: `gradlew`, `gradlew.bat`,
`gradle/wrapper/gradle-wrapper.jar` (~60 KB, binario), `gradle/wrapper/gradle-wrapper.properties`.
npm conserva estos archivos (solo `.gitignore`/`.npmrc` reciben trato especial);
Docker también.

### `templates/manifest.json`

```json
{
  "templates": [
    { "id": "spring-gradle", "label": "Servicio REST — Spring Boot + Gradle",
      "prompts": ["port"] },
    { "id": "java-app",      "label": "App / CLI Java ejecutable + Gradle",
      "prompts": [] },
    { "id": "java-library",  "label": "Librería Java reutilizable + Gradle",
      "prompts": ["withPublish"] }
  ]
}
```

---

## `package.json` (actualizado)

```jsonc
{
  "name": "java-skeleton",          // decisión #1
  "version": "0.1.0",
  "description": "Genera esqueletos de proyectos Java + Gradle (Spring Boot REST, app/CLI o librería)",
  "type": "module",
  "bin": { "java-skeleton": "./bin/cli.js" },
  "files": ["bin", "templates"],          // qué se publica
  "engines": { "node": ">=20" },
  "license": "MIT",
  "repository": { "type": "git", "url": "https://github.com/<usuario>/java-skeleton" },
  "keywords": ["java", "gradle", "spring-boot", "scaffold", "generator", "starter"],
  "dependencies": {
    "commander": "^12.1.0",
    "@inquirer/prompts": "^7.2.0",        // más liviano que inquirer completo
    "handlebars": "^4.7.8",
    "fs-extra": "^11.2.0"
  }
}
```

---

## `Dockerfile`

```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY bin ./bin
COPY templates ./templates
WORKDIR /work
ENTRYPOINT ["node", "/app/bin/cli.js"]
```

`.dockerignore`: `node_modules`, `.git`, `*.md`, `Dockerfile`, `.github`.

**Lockfile sin Node local** — generarlo dentro de un contenedor descartable:

```
docker run --rm -v "$PWD":/app -w /app node:22-alpine npm install --package-lock-only
```

---

## Ergonomía de uso

```bash
docker run --rm -it \
  -u "$(id -u):$(id -g)" \          # archivos con tu usuario, no root
  -v "$PWD:/work" -w /work \
  ghcr.io/<usuario>/java-skeleton [flags]
```

- Script `scripts/java-skeleton` (bash) que expande ese `docker run`; el usuario lo
  copia a `~/.local/bin/` y luego escribe solo `java-skeleton`.
- `README.md` documenta las dos vías: `docker run ...` y `npm create java-service`.

---

## Distribución

- **GHCR** (`.github/workflows/release.yml`, dispara en tag `v*`):
  `docker buildx build --push -t ghcr.io/<usuario>/java-skeleton:$TAG -t ...:latest`
- **npm**: en el mismo workflow, `npm publish --access public` (secret `NPM_TOKEN`).
  Primera publicación a mano.
- Ambos marcados **fase 2**: primero validar local, después automatizar.

---

## Plan de verificación (todo vía Docker, sin Node en el host)

1. **Lockfile**: `docker run --rm -v "$PWD":/app -w /app node:22-alpine npm install --package-lock-only`
2. **Build imagen**: `docker build -t java-skeleton:dev .`
3. **Smoke test spring (no interactivo)**:
   ```
   D=$(mktemp -d); docker run --rm -u "$(id -u):$(id -g)" -v "$D:/work" java-skeleton:dev \
     --yes --template spring-gradle --name demo --group com.acme --artifact demo --java 21 --port 8080
   ```
4. `cd "$D/demo" && ./gradlew build` en el host (JDK 21 presente) → `BUILD SUCCESSFUL`,
   test de `HelloController` en verde.
5. Repetir 3–4 con `--template java-app` y con `--template java-library --with-publish`
   (este último: verificar además `./gradlew publishToMavenLocal`).
6. **Test interactivo**: `docker run --rm -it -u ... -v ... java-skeleton:dev` y responder prompts.
7. Verificar que los archivos generados pertenecen a tu usuario (no `root`).
8. `docker run --rm java-skeleton:dev --help` muestra uso y flags.
9. (npm, opcional) `docker run --rm -v "$PWD":/app -w /app node:22-alpine npx --yes . --help`
   para validar el paquete tal como se publicaría.

---

## Orden de ejecución sugerido

1. `git init` + `.gitignore` del repo (decisión #4).
2. Actualizar `package.json`; generar `package-lock.json` vía contenedor.
3. Completar template `spring-gradle` (toolchain, test, README, `.gitignore`).
4. Generar wrapper en `spring-gradle`.
5. Crear templates `java-app` y `java-library` completos + wrapper en cada uno.
6. `templates/manifest.json` (3 entradas).
7. Reescribir `bin/cli.js` (multi-template, flags, validación, chmod).
8. `Dockerfile` + `.dockerignore`.
9. Verificación 1–8.
10. `README.md` + `LICENSE`.
11. (Fase 2) `.github/workflows/release.yml`, primera publicación manual a GHCR y npm.

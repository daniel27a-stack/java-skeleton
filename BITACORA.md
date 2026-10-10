# Bitácora de java-skeleton

Registro de los pasos hechos sobre el generador, en orden. Cada entrada dice **qué** se
cambió, **por qué** y **cómo se verificó**. Las decisiones de arquitectura de pirca
(BC/MC/ACL/lib, naming `cl.pirca`) se registran aparte; aquí va solo lo del template.

## Plan del template (definido 2026-10-10)

1. ✅ Spring Boot 4 + Java 25
2. ⬜ Gradle dividido en `gradle/*.gradle`
3. ⬜ Source sets `intTest` (WireMock) y `archTest` (ArchUnit)
4. ⬜ Calidad: SpotBugs + FindSecBugs, JaCoCo con umbral, PIT manual
5. ⬜ Actuator: health liveness/readiness + rutas `/api/<artefacto>/v1`
6. ⬜ `Dockerfile` multi-stage con capas de Spring Boot
7. ⬜ Template de librería Spring (auto-configuración) para `lib-*`

---

## 2026-10-10 — Paso 1: Spring Boot 4.1.1 + Java 25

**Qué:**
- `spring-gradle`: Spring Boot `3.5.16` → `4.1.1`.
  - `spring-boot-starter-web` → `spring-boot-starter-webmvc` (Boot 4 se modularizó).
  - `spring-boot-starter-test` → `spring-boot-starter-webmvc-test` (trae `starter-test` + MockMvc).
  - `@WebMvcTest` cambió de paquete: `org.springframework.boot.webmvc.test.autoconfigure`.
- `java-app` y `java-library`: JUnit BOM `5.11.4` → `6.1.3`.
- CLI: Java por defecto `21` → `25` (siguen disponibles 17, 21 y 25).
- README: ejemplos con `--java 25`.

**Por qué:** Java 25 es la LTS vigente (la próxima es la 29, sept 2027) y el stack del
trabajo ya migró a Java 25 + Spring Boot 4. Un proyecto nuevo no debe nacer una LTS atrás.
Beneficios concretos: `ScopedValue` final (candidato para `lib-tenant`), virtual threads sin
pinning en `synchronized`, compact object headers, caché AOT.

**Sin cambio:** Gradle wrapper sigue en `9.5.1` (ya soporta Java 25).

**Requisito local:** JDK `25.0.4-tem` instalado con SDKMAN, sin dejarlo como default
(el default sigue en 21). Gradle lo encuentra solo vía toolchain.

**Verificación:** imagen `java-skeleton:dev` reconstruida; los 3 templates generados con
`--java 25`, `./gradlew build` en verde (1/1 test cada uno). `spring-gradle` arranca en
~1,8 s y `GET /hello` responde. `java-library` pasa `publishToMavenLocal`.

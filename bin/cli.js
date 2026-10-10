#!/usr/bin/env node
import { Command } from 'commander';
import { select, input, confirm } from '@inquirer/prompts';
import Handlebars from 'handlebars';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const TEMPLATES_DIR = path.join(ROOT, 'templates');

const pkg = fs.readJsonSync(path.join(ROOT, 'package.json'));
const manifest = fs.readJsonSync(path.join(TEMPLATES_DIR, 'manifest.json'));

const JAVA_VERSIONS = ['17', '21', '25'];
const GROUP_RE = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$/;
const ARTIFACT_RE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

const program = new Command();
program
  .name('java-skeleton')
  .description('Genera un esqueleto de proyecto Java + Gradle (Spring Boot REST, app/CLI o librería)')
  .version(pkg.version)
  .option('-t, --template <id>', `template a usar (${manifest.templates.map((t) => t.id).join(', ')})`)
  .option('-n, --name <nombre>', 'nombre del proyecto/servicio')
  .option('-g, --group <groupId>', 'group id, ej: com.empresa')
  .option('-a, --artifact <artifactId>', 'artifact id (carpeta de salida)')
  .option('-j, --java <version>', `versión de Java (${JAVA_VERSIONS.join(' | ')})`)
  .option('-p, --port <puerto>', 'puerto del servicio (solo spring-gradle)')
  .option('--with-publish', 'incluir configuración maven-publish (solo java-library)')
  .option('-d, --dir <ruta>', 'directorio base donde crear el proyecto', process.cwd())
  .option('-y, --yes', 'no preguntar; usar defaults para lo que falte')
  .parse();

const opts = program.opts();

function fail(msg) {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
}

// Sin terminal interactiva no se puede preguntar: exigir --yes (o flags + --yes).
if (!process.stdin.isTTY && !opts.yes) {
  fail(
    'no hay terminal interactiva.\n' +
      '  - Para el modo interactivo: agregá -it al docker run.\n' +
      '  - Para modo desatendido: pasá --yes junto con los flags (--template, --name, --group, --artifact, --java).',
  );
}

function validateGroup(v) {
  return GROUP_RE.test(v) || 'formato inválido (ej: com.empresa.proyecto)';
}

function validateArtifact(v) {
  return ARTIFACT_RE.test(v) || 'solo minúsculas, números y guiones, ej: mi-servicio';
}

function validateJava(v) {
  return JAVA_VERSIONS.includes(v) || `elegí una de: ${JAVA_VERSIONS.join(', ')}`;
}

function validatePort(v) {
  return /^\d{2,5}$/.test(v) || 'puerto inválido';
}

function toPascalCase(str) {
  return str
    .split(/[-_]/)
    .filter(Boolean)
    .map((s) => s[0].toUpperCase() + s.slice(1))
    .join('');
}

async function resolveTemplate() {
  if (opts.template) {
    const t = manifest.templates.find((x) => x.id === opts.template);
    if (!t) {
      fail(`template desconocido: ${opts.template}. Opciones: ${manifest.templates.map((x) => x.id).join(', ')}`);
    }
    return t;
  }
  if (opts.yes) return manifest.templates[0];
  const id = await select({
    message: 'Tipo de proyecto:',
    choices: manifest.templates.map((t) => ({ name: t.label, value: t.id })),
  });
  return manifest.templates.find((t) => t.id === id);
}

// Devuelve el valor de un flag (validándolo) o pregunta; con --yes usa el default.
async function ask(flag, message, def, validate) {
  const provided = opts[flag];
  if (provided != null) {
    const value = String(provided);
    if (validate) {
      const res = validate(value);
      if (res !== true) fail(`--${flag}: ${res}`);
    }
    return value;
  }
  if (opts.yes) return def;
  return input({ message, default: def, validate });
}

async function renderDir(srcDir, destDir, context) {
  const entries = await fs.readdir(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, renderName(entry.name, context));

    if (entry.isDirectory()) {
      await fs.ensureDir(destPath);
      await renderDir(srcPath, destPath, context);
      continue;
    }

    await fs.ensureDir(path.dirname(destPath));
    if (entry.name.endsWith('.hbs')) {
      const raw = await fs.readFile(srcPath, 'utf-8');
      const rendered = Handlebars.compile(raw, { noEscape: true })(context);
      await fs.writeFile(destPath, rendered);
    } else {
      // binario o verbatim (gradle-wrapper.jar, gradlew, ...)
      await fs.copyFile(srcPath, destPath);
    }
  }
}

// Quita el sufijo .hbs y sustituye {{token}} en nombres de archivo/carpeta.
function renderName(segment, context) {
  const base = segment.endsWith('.hbs') ? segment.slice(0, -4) : segment;
  return base.replace(/\{\{(\w+)\}\}/g, (_, key) => context[key] ?? '');
}

async function main() {
  const template = await resolveTemplate();

  const serviceName = await ask('name', 'Nombre del proyecto:', 'mi-servicio');
  const groupId = await ask('group', 'Group ID:', 'com.empresa', validateGroup);
  const artifactId = await ask('artifact', 'Artifact ID:', serviceName, validateArtifact);
  const javaVersion = await ask('java', `Versión de Java (${JAVA_VERSIONS.join('/')}):`, '25', validateJava);

  let port = '8080';
  if (template.prompts.includes('port')) {
    port = await ask('port', 'Puerto del servicio:', '8080', validatePort);
  }

  let withPublish = false;
  if (template.prompts.includes('withPublish')) {
    if (opts.withPublish) withPublish = true;
    else if (!opts.yes) withPublish = await confirm({ message: '¿Incluir maven-publish?', default: false });
  }

  const context = {
    serviceName,
    groupId,
    artifactId,
    javaVersion,
    port,
    withPublish,
    packagePath: groupId.replace(/\./g, '/'),
    className: toPascalCase(artifactId),
  };

  const templateDir = path.join(TEMPLATES_DIR, template.id);
  const targetDir = path.join(path.resolve(opts.dir || process.cwd()), artifactId);

  if (await fs.pathExists(targetDir)) {
    fail(`ya existe "${targetDir}"; elegí otro artifact id o borrá esa carpeta.`);
  }

  await renderDir(templateDir, targetDir, context);

  const gradlew = path.join(targetDir, 'gradlew');
  if (await fs.pathExists(gradlew)) await fs.chmod(gradlew, 0o755);

  const rel = path.relative(process.cwd(), targetDir) || artifactId;
  console.log(`\n✔ Proyecto "${artifactId}" (${template.id}) creado en ${targetDir}\n`);
  console.log(`  cd ${rel}`);
  console.log(`  ./gradlew build\n`);
}

main().catch((err) => {
  if (err && err.name === 'ExitPromptError') process.exit(130); // Ctrl-C en un prompt
  fail(err?.message || String(err));
});

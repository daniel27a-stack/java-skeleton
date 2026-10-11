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
  .description('Generates a Java + Gradle project skeleton (Spring Boot REST service, app/CLI or library)')
  .version(pkg.version)
  .option('-t, --template <id>', `template to use (${manifest.templates.map((t) => t.id).join(', ')})`)
  .option('-n, --name <name>', 'project/service name')
  .option('-g, --group <groupId>', 'group id, e.g. com.example')
  .option('-a, --artifact <artifactId>', 'artifact id (output folder)')
  .option('-j, --java <version>', `Java version (${JAVA_VERSIONS.join(' | ')})`)
  .option('-p, --port <port>', 'service port (spring-gradle only)')
  .option('--with-publish', 'include maven-publish setup (java-library only)')
  .option('-d, --dir <path>', 'base directory where the project is created', process.cwd())
  .option('-y, --yes', 'do not prompt; use defaults for anything missing')
  .parse();

const opts = program.opts();

function fail(msg) {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
}

// Without an interactive terminal we cannot prompt: require --yes (or flags + --yes).
if (!process.stdin.isTTY && !opts.yes) {
  fail(
    'no interactive terminal.\n' +
      '  - For interactive mode: add -it to docker run.\n' +
      '  - For unattended mode: pass --yes along with the flags (--template, --name, --group, --artifact, --java).',
  );
}

function validateGroup(v) {
  return GROUP_RE.test(v) || 'invalid format (e.g. com.example.project)';
}

function validateArtifact(v) {
  return ARTIFACT_RE.test(v) || 'lowercase letters, digits and hyphens only, e.g. my-service';
}

function validateJava(v) {
  return JAVA_VERSIONS.includes(v) || `choose one of: ${JAVA_VERSIONS.join(', ')}`;
}

function validatePort(v) {
  return /^\d{2,5}$/.test(v) || 'invalid port';
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
      fail(`unknown template: ${opts.template}. Options: ${manifest.templates.map((x) => x.id).join(', ')}`);
    }
    return t;
  }
  if (opts.yes) return manifest.templates[0];
  const id = await select({
    message: 'Project type:',
    choices: manifest.templates.map((t) => ({ name: t.label, value: t.id })),
  });
  return manifest.templates.find((t) => t.id === id);
}

// Returns a flag's value (validated) or prompts for it; with --yes uses the default.
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
      // A template that renders to nothing (e.g. wrapped in {{#if flag}}) is optional: skip it.
      if (rendered.trim() === '') continue;
      await fs.writeFile(destPath, rendered);
    } else {
      // binary or verbatim (gradle-wrapper.jar, gradlew, ...)
      await fs.copyFile(srcPath, destPath);
    }
  }
}

// Strips the .hbs suffix and replaces {{token}} in file/folder names.
function renderName(segment, context) {
  const base = segment.endsWith('.hbs') ? segment.slice(0, -4) : segment;
  return base.replace(/\{\{(\w+)\}\}/g, (_, key) => context[key] ?? '');
}

async function main() {
  const template = await resolveTemplate();

  const serviceName = await ask('name', 'Project name:', 'my-service');
  const groupId = await ask('group', 'Group ID:', 'com.example', validateGroup);
  const artifactId = await ask('artifact', 'Artifact ID:', serviceName, validateArtifact);
  const javaVersion = await ask('java', `Java version (${JAVA_VERSIONS.join('/')}):`, '25', validateJava);

  let port = '8080';
  if (template.prompts.includes('port')) {
    port = await ask('port', 'Service port:', '8080', validatePort);
  }

  let withPublish = false;
  if (template.prompts.includes('withPublish')) {
    if (opts.withPublish) withPublish = true;
    else if (!opts.yes) withPublish = await confirm({ message: 'Include maven-publish?', default: false });
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
    fail(`"${targetDir}" already exists; choose another artifact id or delete that folder.`);
  }

  await renderDir(templateDir, targetDir, context);

  const gradlew = path.join(targetDir, 'gradlew');
  if (await fs.pathExists(gradlew)) await fs.chmod(gradlew, 0o755);

  const rel = path.relative(process.cwd(), targetDir) || artifactId;
  console.log(`\n✔ Project "${artifactId}" (${template.id}) created in ${targetDir}\n`);
  console.log(`  cd ${rel}`);
  console.log(`  ./gradlew build\n`);
}

main().catch((err) => {
  if (err && err.name === 'ExitPromptError') process.exit(130); // Ctrl-C at a prompt
  fail(err?.message || String(err));
});

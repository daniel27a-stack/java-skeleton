#!/usr/bin/env node
import { Command } from 'commander';
import { select, input } from '@inquirer/prompts';
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
const TYPE_IDS = manifest.types.map((t) => t.id);
const PRODUCT_RE = /^[a-z][a-z0-9]*$/;
const SERVICE_NAME_RE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
const LIB_NAME_RE = /^[a-z][a-z0-9]*$/;

const program = new Command();
program
  .name('java-skeleton')
  .description(`pirca generator: creates a project by artifact type (${TYPE_IDS.join(', ')})`)
  .version(pkg.version)
  .option('-t, --type <type>', `artifact type (${TYPE_IDS.join(', ')})`)
  .option('--product <product>', 'product, e.g. gastos (services only)')
  .option('-n, --name <name>', 'artifact name, e.g. expense')
  .option('-j, --java <version>', `Java version (${JAVA_VERSIONS.join(' | ')}), default 25`)
  .option('-p, --port <port>', 'service port (services only), default 8080')
  .option('-d, --dir <path>', 'base directory where the project is created', process.cwd())
  .option('-y, --yes', 'do not prompt; --type, --name and --product (services) are required')
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
      '  - For unattended mode: pass --yes along with the flags (--type, --name, and --product for services).',
  );
}

function validateType(v) {
  return TYPE_IDS.includes(v) || `unknown type "${v}". Options: ${TYPE_IDS.join(', ')}`;
}

function validateProduct(v) {
  return PRODUCT_RE.test(v) || 'lowercase letters and digits only, starting with a letter (no hyphens), e.g. gastos';
}

function validateName(kind) {
  return (v) =>
    kind === 'lib'
      ? LIB_NAME_RE.test(v) || 'lib name: lowercase letters and digits only, starting with a letter (no hyphens), e.g. errors'
      : SERVICE_NAME_RE.test(v) || 'lowercase letters, digits and single hyphens, starting with a letter, e.g. expense-claims';
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

async function resolveType() {
  let id = opts.type;
  if (id != null) {
    const res = validateType(id);
    if (res !== true) fail(`--type: ${res}`);
  } else if (opts.yes) {
    fail(`missing --type (${TYPE_IDS.join(', ')})`);
  } else {
    id = await select({ message: 'Artifact type:', choices: TYPE_IDS.map((t) => ({ name: t, value: t })) });
  }
  return manifest.types.find((t) => t.id === id);
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
  if (opts.yes) {
    if (def === undefined) fail(`missing --${flag}`);
    return def;
  }
  return input({ message, ...(def !== undefined && { default: def }), validate });
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

function derive(type, product, name) {
  if (type.kind === 'lib') {
    return { artifactId: `lib-${name}`, groupId: `cl.pirca.lib.${name}`, repoName: `lib-${name}` };
  }
  return { artifactId: `${type.id}-${name}`, groupId: `cl.pirca.${product}`, repoName: `${product}-${type.id}-${name}` };
}

async function main() {
  const type = await resolveType();

  let product;
  if (type.kind === 'lib') {
    if (opts.product != null) fail('--product is not accepted for lib');
  } else {
    product = await ask('product', 'Product (e.g. gastos):', undefined, validateProduct);
  }
  const name = await ask('name', 'Name (e.g. expense):', undefined, validateName(type.kind));
  // Java and port are never prompted: flags or defaults.
  const javaVersion = opts.java != null ? String(opts.java) : '25';
  const javaCheck = validateJava(javaVersion);
  if (javaCheck !== true) fail(`--java: ${javaCheck}`);
  const port = opts.port != null ? String(opts.port) : '8080';
  const portCheck = validatePort(port);
  if (portCheck !== true) fail(`--port: ${portCheck}`);

  const { artifactId, groupId, repoName } = derive(type, product, name);

  const context = {
    serviceName: repoName,
    groupId,
    artifactId,
    javaVersion,
    port,
    packagePath: groupId.replace(/\./g, '/'),
    className: toPascalCase(artifactId),
  };

  const templateDir = path.join(TEMPLATES_DIR, type.template);
  const targetDir = path.join(path.resolve(opts.dir || process.cwd()), repoName);

  if (await fs.pathExists(targetDir)) {
    fail(`"${targetDir}" already exists; choose another name or delete that folder.`);
  }

  await renderDir(templateDir, targetDir, context);

  const gradlew = path.join(targetDir, 'gradlew');
  if (await fs.pathExists(gradlew)) await fs.chmod(gradlew, 0o755);

  const rel = path.relative(process.cwd(), targetDir) || repoName;
  console.log(`\n✔ ${type.id} "${repoName}" created in ${targetDir}`);
  console.log(`  artifact ID: ${artifactId}`);
  console.log(`  group ID / package: ${groupId}\n`);
  console.log(`  cd ${rel}`);
  console.log(`  ./gradlew build\n`);
}

main().catch((err) => {
  if (err && err.name === 'ExitPromptError') process.exit(130); // Ctrl-C at a prompt
  fail(err?.message || String(err));
});

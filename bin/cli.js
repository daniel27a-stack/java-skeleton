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

// Single place for the Java version used by every generated project.
const JAVA_VERSION = '25';

const PRODUCT_RE = /^[a-z][a-z0-9]*$/;
const SERVICE_NAME_RE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
const LIB_NAME_RE = /^[a-z][a-z0-9]*$/;

const TYPE_IDS = manifest.types.map((t) => t.id);

const program = new Command();
program
  .name('java-skeleton')
  .description('Generates pirca projects: REST services (edge, flow, data, acl) and libraries')
  .version(pkg.version, '--version', 'print the version')
  .helpOption('--help', 'show this help')
  .allowExcessArguments(false)
  .option('--yes', 'do not prompt; requires --type and --name (and --product for services)')
  .option('--type <type>', `artifact type (${TYPE_IDS.join(', ')})`)
  .option('--name <name>', 'artifact name')
  .option('--product <product>', 'product name (services only, not for lib)')
  .parse();

const opts = program.opts();

function fail(msg) {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
}

function validateProduct(v) {
  return PRODUCT_RE.test(v) || 'lowercase letters and digits, starting with a letter, e.g. gastos';
}

function validateName(type) {
  if (type === 'lib') {
    return (v) => LIB_NAME_RE.test(v) || 'lowercase letters and digits, starting with a letter, e.g. errors';
  }
  return (v) =>
    SERVICE_NAME_RE.test(v) ||
    'lowercase letters, digits and single hyphens, starting with a letter, e.g. expense-claims';
}

// Checks that run before anything is asked or written.
const flagsGiven = opts.type !== undefined || opts.name !== undefined || opts.product !== undefined;
if (flagsGiven && !opts.yes) {
  fail('--type, --name and --product can only be used together with --yes.');
}
if (!process.stdin.isTTY && !opts.yes) {
  fail(
    'no interactive terminal.\n' +
      '  - For interactive mode: add -it to docker run.\n' +
      '  - For unattended mode: pass --yes --type <type> --name <name> [--product <product>].',
  );
}

// Non-interactive mode: validates the flags and returns { type, product, name }.
function fromFlags() {
  const { type, product, name } = opts;
  if (type === undefined || type === '') fail(`--type is required. Options: ${TYPE_IDS.join(', ')}`);
  if (!TYPE_IDS.includes(type)) fail(`unknown type: ${type}. Options: ${TYPE_IDS.join(', ')}`);
  if (type === 'lib') {
    if (product !== undefined) fail('--product is not allowed with --type lib.');
  } else {
    if (product === undefined) fail(`--product is required for --type ${type}.`);
    const res = validateProduct(product);
    if (res !== true) fail(`--product: ${res}`);
  }
  if (name === undefined || name === '') fail('--name is required.');
  const res = validateName(type)(name);
  if (res !== true) fail(`--name: ${res}`);
  return { type, product, name };
}

// Interactive mode: asks type, then product (services only), then name; invalid values are re-asked.
async function fromPrompts() {
  const type = await select({
    message: 'Type:',
    choices: manifest.types.map((t) => ({ name: t.label, value: t.id })),
  });
  let product;
  if (type !== 'lib') {
    product = await input({ message: 'Product:', validate: validateProduct });
  }
  const name = await input({ message: 'Name:', validate: validateName(type) });
  return { type, product, name };
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
      // A template that renders to nothing (e.g. wrapped in a false {{#if}}) is optional: skip it.
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
  const { type, product, name } = opts.yes ? fromFlags() : await fromPrompts();
  const template = manifest.types.find((t) => t.id === type).template;

  const isLib = type === 'lib';
  const serviceName = isLib ? `lib-${name}` : `${product}-${type}-${name}`;
  const artifactId = isLib ? `lib-${name}` : `${type}-${name}`;
  const groupId = isLib ? `cl.pirca.lib.${name}` : `cl.pirca.${product}`;

  const context = {
    serviceName,
    groupId,
    artifactId,
    javaVersion: JAVA_VERSION,
    packagePath: groupId.replace(/\./g, '/'),
  };

  const templateDir = path.join(TEMPLATES_DIR, template);
  const targetDir = path.join(process.cwd(), serviceName);

  if (await fs.pathExists(targetDir)) {
    fail(`"${targetDir}" already exists; choose another name or delete that folder.`);
  }

  await renderDir(templateDir, targetDir, context);

  const gradlew = path.join(targetDir, 'gradlew');
  if (await fs.pathExists(gradlew)) await fs.chmod(gradlew, 0o755);
}

main().catch((err) => {
  if (err && err.name === 'ExitPromptError') process.exit(130); // Ctrl-C at a prompt
  fail(err?.message || String(err));
});

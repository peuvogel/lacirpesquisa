import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AUDITED_EXTENSIONS = new Set(['.css', '.html', '.js', '.json']);
const AUDIT_MODES = new Set(['offline', 'pages']);
const INTERNAL_SVG_NAMESPACE = 'https://www.w3.org/2000/svg';
const FORBIDDEN_RUNTIME_MARKERS = [
  '@supabase/supabase-js',
  'supabase.co',
  '/rest/v1',
  '/data/catalog',
  'MapasPage',
  'VariaveisPage',
  'MetaAnalisePage',
  'fingerprintResearchDesign',
  'mapSelection',
  'guidedAnalysis',
  'ParticleText',
  'StickerPeel',
  'requestAnimationFrame(loop)',
];

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function compareFindings(left, right) {
  return compareText(left.file, right.file)
    || compareText(left.code, right.code)
    || compareText(left.detail, right.detail);
}

function relativeReleasePath(root, target) {
  return path.relative(root, target).split(path.sep).join('/');
}

async function collectAuditedFiles(root, current, files) {
  let entries;
  try {
    entries = await readdir(current, { withFileTypes: true });
  } catch (error) {
    throw new Error(
      `Não foi possível percorrer o diretório de release ${current}: ${error.message}`,
      { cause: error },
    );
  }

  entries.sort((left, right) => compareText(left.name, right.name));
  for (const entry of entries) {
    const target = path.join(current, entry.name);
    if (entry.isDirectory()) {
      await collectAuditedFiles(root, target, files);
      continue;
    }
    if (!entry.isFile() || !AUDITED_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      continue;
    }
    files.push(relativeReleasePath(root, target));
  }
}

function maskLocalSchemeUrls(contents) {
  return contents.replace(/(?:data|blob):[^\s"'`<>]*/gi, (value) => ' '.repeat(value.length));
}

function externalUrls(contents) {
  const candidates = new Set();
  const searchable = maskLocalSchemeUrls(contents);
  const urlPattern = /https?:(?:\/\/|\\\/\\\/)[^\s"'`<>()\[\]{}]+/gi;

  for (const match of searchable.matchAll(urlPattern)) {
    const normalized = match[0].replaceAll('\\/', '/');
    if (normalized === INTERNAL_SVG_NAMESPACE) continue;
    if (FORBIDDEN_RUNTIME_MARKERS.some((marker) => normalized.includes(marker))) continue;
    candidates.add(normalized);
  }

  return [...candidates].sort(compareText);
}

function findingsForFile(file, contents) {
  const findings = [];

  for (const marker of FORBIDDEN_RUNTIME_MARKERS) {
    if (contents.includes(marker)) {
      findings.push({ code: 'forbidden-runtime-marker', file, detail: marker });
    }
  }
  for (const url of externalUrls(contents)) {
    findings.push({ code: 'external-url', file, detail: url });
  }

  return findings;
}

/** @typedef {{ code: string, file: string, detail: string }} ReleaseAuditFinding */
/** @typedef {{ mode?: 'pages' | 'offline' }} ReleaseAuditOptions */

/**
 * @param {string} directory
 * @param {ReleaseAuditOptions} options
 * @returns {Promise<{ files: string[], findings: ReleaseAuditFinding[] }>}
 */
export async function auditReleaseDirectory(
  directory,
  options = /** @type {ReleaseAuditOptions} */ ({}),
) {
  if (typeof directory !== 'string' || directory.trim() === '') {
    throw new TypeError('O diretório de release deve ser informado.');
  }
  if (options.mode !== undefined && !AUDIT_MODES.has(options.mode)) {
    throw new TypeError(`Modo de auditoria inválido: ${options.mode}`);
  }

  const root = path.resolve(directory);
  let rootStats;
  try {
    rootStats = await stat(root);
  } catch (error) {
    throw new Error(
      `Não foi possível auditar o diretório de release ${root}: ${error.message}`,
      { cause: error },
    );
  }
  if (!rootStats.isDirectory()) {
    throw new Error(`Não foi possível auditar o diretório de release ${root}: não é um diretório.`);
  }

  const files = [];
  await collectAuditedFiles(root, root, files);
  files.sort(compareText);

  const findings = [];
  for (const file of files) {
    const target = path.join(root, ...file.split('/'));
    let contents;
    try {
      contents = await readFile(target, 'utf8');
    } catch (error) {
      throw new Error(`Não foi possível ler ${file}: ${error.message}`, { cause: error });
    }
    findings.push(...findingsForFile(file, contents));
  }
  findings.sort(compareFindings);

  return { files, findings };
}

/**
 * @param {{ files: string[], findings: ReleaseAuditFinding[] }} report
 * @returns {void}
 */
export function assertReleaseAudit(report) {
  if (!report || !Array.isArray(report.files) || !Array.isArray(report.findings)) {
    throw new TypeError('Relatório de auditoria de release inválido.');
  }
  if (report.findings.length === 0) return;

  const findings = [...report.findings].sort(compareFindings);
  throw new Error([
    `Auditoria de release encontrou ${findings.length} problema(s):`,
    ...findings.map(({ code, file, detail }) => `${file} [${code}] ${detail}`),
  ].join('\n'));
}

function parseCliArguments(argumentsList) {
  let directory;
  let mode;

  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    if (argument === '--mode') {
      if (index + 1 >= argumentsList.length) {
        throw new Error('A opção --mode exige pages ou offline.');
      }
      mode = argumentsList[index + 1];
      index += 1;
      continue;
    }
    if (argument.startsWith('--mode=')) {
      mode = argument.slice('--mode='.length);
      continue;
    }
    if (argument.startsWith('-')) {
      throw new Error(`Opção desconhecida: ${argument}`);
    }
    if (directory !== undefined) {
      throw new Error(`Argumento inesperado: ${argument}`);
    }
    directory = argument;
  }

  if (!directory) {
    throw new Error(
      'Uso: node scripts/release/audit-release.mjs <diretório> [--mode pages|offline]',
    );
  }

  return { directory, options: mode === undefined ? {} : { mode } };
}

async function runCli() {
  const { directory, options } = parseCliArguments(process.argv.slice(2));
  const report = await auditReleaseDirectory(directory, options);
  assertReleaseAudit(report);
  process.stdout.write(
    `Auditoria de release aprovada: ${report.files.length} arquivo(s) verificado(s).\n`,
  );
}

const isMain = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  runCli().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}

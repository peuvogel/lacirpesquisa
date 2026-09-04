import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { assertReleaseAudit, auditReleaseDirectory } from './audit-release.mjs';

const SCRIPT_PATH = fileURLToPath(new URL('./audit-release.mjs', import.meta.url));

let fixtureDir;

async function writeFixture(relativePath, contents) {
  const target = path.join(fixtureDir, relativePath);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, contents);
  return target;
}

beforeEach(async () => {
  fixtureDir = await mkdtemp(path.join(tmpdir(), 'lacir-release-audit-'));
});

afterEach(async () => {
  await rm(fixtureDir, { recursive: true, force: true });
});

describe('auditReleaseDirectory', () => {
  it('rejects closed-module and Supabase markers with deterministic file details', async () => {
    await writeFixture('z-last.json', '{"module":"MapasPage"}');
    await writeFixture(
      'assets/nested/app.js',
      'createClient("https://x.supabase.co"); ParticleText(); requestAnimationFrame(loop);',
    );
    await writeFixture('assets/first.css', 'url("/data/catalog/municipios.json")');

    const report = await auditReleaseDirectory(fixtureDir);

    assert.deepEqual(report.files, [
      'assets/first.css',
      'assets/nested/app.js',
      'z-last.json',
    ]);
    assert.deepEqual(report.findings, [
      {
        code: 'forbidden-runtime-marker',
        file: 'assets/first.css',
        detail: '/data/catalog',
      },
      {
        code: 'forbidden-runtime-marker',
        file: 'assets/nested/app.js',
        detail: 'ParticleText',
      },
      {
        code: 'forbidden-runtime-marker',
        file: 'assets/nested/app.js',
        detail: 'requestAnimationFrame(loop)',
      },
      {
        code: 'forbidden-runtime-marker',
        file: 'assets/nested/app.js',
        detail: 'supabase.co',
      },
      {
        code: 'forbidden-runtime-marker',
        file: 'z-last.json',
        detail: 'MapasPage',
      },
    ]);
  });

  it('rejects external HTTP URLs while allowing local URL schemes and the SVG namespace', async () => {
    await writeFixture(
      'index.html',
      [
        '<svg xmlns="https://www.w3.org/2000/svg"></svg>',
        '<img src="data:image/png;base64,AAAA">',
        '<a href="blob:https://local.invalid/id">local download</a>',
        '<script src="https://cdn.example/app.js"></script>',
        '<a href="http:\\/\\/docs.example\\/guide">docs</a>',
      ].join('\n'),
    );

    const report = await auditReleaseDirectory(fixtureDir, { mode: 'offline' });

    assert.deepEqual(report.findings, [
      {
        code: 'external-url',
        file: 'index.html',
        detail: 'http://docs.example/guide',
      },
      {
        code: 'external-url',
        file: 'index.html',
        detail: 'https://cdn.example/app.js',
      },
    ]);
  });

  it('recurses through regular release files and ignores extensions and symlinks', async () => {
    const ignoredTarget = await writeFixture('ignored/notes.txt', 'https://ignored.example');
    await writeFixture('assets/image.png', 'MapasPage https://ignored.example');
    await writeFixture('assets/clean.js', 'const local = "data:text/plain,ok";');
    await symlink(ignoredTarget, path.join(fixtureDir, 'linked.html'));

    const report = await auditReleaseDirectory(fixtureDir, { mode: 'pages' });

    assert.deepEqual(report.files, ['assets/clean.js']);
    assert.deepEqual(report.findings, []);
    assert.doesNotThrow(() => assertReleaseAudit(report));
  });

  it('rejects unsupported modes and missing directories', async () => {
    await assert.rejects(
      auditReleaseDirectory(fixtureDir, { mode: 'preview' }),
      /Modo de auditoria inválido: preview/,
    );
    await assert.rejects(
      auditReleaseDirectory(path.join(fixtureDir, 'missing')),
      /Não foi possível auditar o diretório de release/,
    );
  });
});

describe('assertReleaseAudit', () => {
  it('throws one stable diagnostic containing every file and marker', () => {
    assert.throws(
      () => assertReleaseAudit({
        files: ['assets/app.js', 'index.html'],
        findings: [
          { code: 'external-url', file: 'index.html', detail: 'https://cdn.example/app.js' },
          { code: 'forbidden-runtime-marker', file: 'assets/app.js', detail: 'StickerPeel' },
        ],
      }),
      {
        message: [
          'Auditoria de release encontrou 2 problema(s):',
          'assets/app.js [forbidden-runtime-marker] StickerPeel',
          'index.html [external-url] https://cdn.example/app.js',
        ].join('\n'),
      },
    );
  });
});

describe('release audit CLI', () => {
  it('exits zero for a clean directory and accepts both mode syntaxes', async () => {
    await writeFixture('index.html', '<svg xmlns="https://www.w3.org/2000/svg"></svg>');

    for (const modeArguments of [['--mode', 'pages'], ['--mode=offline']]) {
      const result = spawnSync(process.execPath, [SCRIPT_PATH, fixtureDir, ...modeArguments], {
        encoding: 'utf8',
      });

      assert.equal(result.status, 0, result.stderr);
      assert.match(result.stdout, /Auditoria de release aprovada: 1 arquivo\(s\) verificado\(s\)\./);
      assert.equal(result.stderr, '');
    }
  });

  it('exits nonzero with deterministic findings and rejects invalid arguments', async () => {
    await writeFixture('assets/app.js', 'StickerPeel();');

    const unsafe = spawnSync(process.execPath, [SCRIPT_PATH, fixtureDir], { encoding: 'utf8' });
    assert.equal(unsafe.status, 1);
    assert.match(unsafe.stderr, /assets\/app\.js \[forbidden-runtime-marker\] StickerPeel/);

    const invalidMode = spawnSync(
      process.execPath,
      [SCRIPT_PATH, fixtureDir, '--mode', 'preview'],
      { encoding: 'utf8' },
    );
    assert.equal(invalidMode.status, 1);
    assert.match(invalidMode.stderr, /Modo de auditoria inválido: preview/);

    const missingDirectory = spawnSync(process.execPath, [SCRIPT_PATH], { encoding: 'utf8' });
    assert.equal(missingDirectory.status, 1);
    assert.match(missingDirectory.stderr, /Uso: node scripts\/release\/audit-release\.mjs/);

    const unknownOption = spawnSync(
      process.execPath,
      [SCRIPT_PATH, fixtureDir, '--unknown'],
      { encoding: 'utf8' },
    );
    assert.equal(unknownOption.status, 1);
    assert.match(unknownOption.stderr, /Opção desconhecida: --unknown/);
  });
});

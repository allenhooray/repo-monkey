import { createWriteStream, existsSync, readFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import archiver from 'archiver';

const DIST_DIR = 'dist';
const MANIFEST_PATH = join(DIST_DIR, 'manifest.json');

async function createZip() {
  if (!existsSync(MANIFEST_PATH)) {
    console.error(`Build output not found: ${MANIFEST_PATH}. Run "npm run build" first.`);
    process.exit(1);
  }

  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
  const version = manifest.version;
  const zipPath = join(process.cwd(), `repo-monkey-v${version}.zip`);

  if (existsSync(zipPath)) {
    unlinkSync(zipPath);
  }

  return new Promise((resolve, reject) => {
    const output = createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => {
      console.log(`\n✅ ZIP created: ${zipPath}`);
      console.log(`   Size: ${(archive.pointer() / 1024).toFixed(2)} KB`);
      resolve(zipPath);
    });

    archive.on('error', reject);
    archive.pipe(output);
    archive.directory(DIST_DIR, false);
    archive.finalize();
  });
}

createZip().catch((err) => {
  console.error(err);
  process.exit(1);
});

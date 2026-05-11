import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync, createWriteStream, unlinkSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import archiver from 'archiver';

const SRC_DIR = 'src';
const PUBLIC_DIR = 'public';
const DIST_DIR = 'dist';

function copyFiles(src, dest) {
  if (!existsSync(src)) return;

  const stat = statSync(src);
  
  if (stat.isDirectory()) {
    if (!existsSync(dest)) {
      mkdirSync(dest, { recursive: true });
    }
    
    const files = readdirSync(src);
    for (const file of files) {
      copyFiles(join(src, file), join(dest, file));
    }
  } else {
    const destDir = dirname(dest);
    if (!existsSync(destDir)) {
      mkdirSync(destDir, { recursive: true });
    }
    copyFileSync(src, dest);
    console.log(`Copied: ${src} → ${dest}`);
  }
}

if (!existsSync(DIST_DIR)) {
  mkdirSync(DIST_DIR, { recursive: true });
}

copyFiles(SRC_DIR, DIST_DIR);
copyFiles(PUBLIC_DIR, DIST_DIR);

console.log('\n✅ Build completed successfully!');
console.log(`\nOutput directory: ${DIST_DIR}`);
console.log('\nYou can now load the extension from:', join(process.cwd(), DIST_DIR));

async function createZip() {
  return new Promise((resolve, reject) => {
    const manifest = JSON.parse(readFileSync(join(PUBLIC_DIR, 'manifest.json'), 'utf8'));
    const version = manifest.version;
    const zipPath = join(process.cwd(), `repo-monkey-v${version}.zip`);
    
    if (existsSync(zipPath)) {
      unlinkSync(zipPath);
    }
    
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

if (process.argv.includes('--zip') || process.argv.includes('-z')) {
  createZip().catch(console.error);
}

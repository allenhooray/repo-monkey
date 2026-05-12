import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync, createWriteStream, unlinkSync, readFileSync } from 'fs';
import { join, dirname, extname } from 'path';
import { execSync } from 'child_process';
import archiver from 'archiver';

const SRC_DIR = 'src';
const PUBLIC_DIR = 'public';
const DIST_DIR = 'dist';

function compileTypeScript() {
  console.log('Compiling TypeScript...');
  try {
    execSync('npx tsc', { stdio: 'inherit' });
    console.log('TypeScript compiled successfully!');
  } catch (error) {
    console.error('TypeScript compilation failed:', error);
    process.exit(1);
  }
}

function copyFiles(src, dest) {
  if (!existsSync(src)) return;

  const stat = statSync(src);
  
  if (stat.isDirectory()) {
    if (!existsSync(dest)) {
      mkdirSync(dest, { recursive: true });
    }
    
    const files = readdirSync(src);
    for (const file of files) {
      const srcPath = join(src, file);
      const ext = extname(file);
      
      if (ext === '.ts') {
        continue;
      }
      
      copyFiles(srcPath, join(dest, file));
    }
  } else {
    const ext = extname(src);
    if (ext === '.ts') {
      return;
    }
    
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

compileTypeScript();
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

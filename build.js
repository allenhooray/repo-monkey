import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';

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

import { createHash } from 'node:crypto';
import { readdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const publicDir = path.resolve(process.argv[2] || 'public');
const manifest = {};

const textExtensions = new Set(['.js', '.css']);
const routeAliases = {
  '#/home': '#/x/h4a9d2',
  '#/projects': '#/x/p8c3q1',
  '#/announcement': '#/x/a7n5s2',
  '#/announcement-stage-1': '#/x/a7n5s2/s1',
  '#/announcement-stage-2': '#/x/a7n5s2/s2',
  '#/announcement-final': '#/x/a7n5s2/sf',
  '#/wall-of-fame': '#/x/w2f8m4',
  '#/leaderboard': '#/x/l6b9r3',
  '#/graduation': '#/x/g5d1u7',
  '#/register': '#/x/r9k2e4',
  '#/profile': '#/x/u3p7v5',
  '#/meeting': '#/x/m7k9p2',
  '#/competency-test': '#/x/t4c8n6',
  '#/dashboard/seleksi': '#/x/d8s2h5/s1',
  '#/dashboard': '#/x/d8s2h5',
  '#/twibbon': '#/x/tw5b1',
  '#/about-us': '#/x/ab2u8',
  '#/curriculum': '#/x/cu7r2',
  '#/faq': '#/x/fq3a6',
  '#/industry-applications': '#/x/in9d4',
  '#/skoring': '#/x/sk4r8',
  '#/ai-prescreening': '#/x/ai2p6',
  '#/anti-fraud': '#/x/fr7c1',
  '#/comm-engine': '#/x/cm8e3',
  '#/competency-monitor': '#/x/ct6m2',
  '#/video-conference': '#/x/vc4o9',
  '#/stage-control': '#/x/sc1t5',
  '#/bootcamp': '#/x/bc9p3',
  '#/final-project': '#/x/fp5j7',
  '#/certificates': '#/x/cr2t8',
  '#/audit-trail': '#/x/at6l4',
  '#/global-settings': '#/x/gs3n9',
  '#/rbac': '#/x/rb8a2',
  '#/assets': '#/x/as4e6'
};

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walk(fullPath));
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

function hashContent(content) {
  return createHash('sha256').update(content).digest('hex').slice(0, 12);
}

function obfuscateJavaScript(source) {
  const encoded = Buffer.from(minifyJavaScript(source), 'utf8').toString('base64');
  const chunks = encoded.match(/.{1,6000}/g) || [];
  return `(()=>{const p=${JSON.stringify(chunks)}.join("");const b=atob(p);const a=new Uint8Array(b.length);for(let i=0;i<b.length;i++)a[i]=b.charCodeAt(i);(0,eval)(new TextDecoder().decode(a));})();\n`;
}

function minifyJavaScript(source) {
  const withoutComments = stripJavaScriptComments(source);
  return withoutComments
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .join('\n');
}

function stripJavaScriptComments(source) {
  let output = '';
  let quote = '';
  let escaped = false;
  let templateDepth = 0;
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    const next = source[i + 1];

    if (quote) {
      output += char;
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (quote === '`' && char === '$' && next === '{') {
        output += next;
        i++;
        templateDepth++;
      } else if (quote === '`' && char === '}' && templateDepth > 0) {
        templateDepth--;
      } else if (char === quote && (quote !== '`' || templateDepth === 0)) {
        quote = '';
      }
      continue;
    }

    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      output += char;
      continue;
    }

    if (char === '/' && next === '/') {
      while (i < source.length && source[i] !== '\n') i++;
      output += '\n';
      continue;
    }

    if (char === '/' && next === '*') {
      i += 2;
      while (i < source.length && !(source[i] === '*' && source[i + 1] === '/')) i++;
      i++;
      continue;
    }

    output += char;
  }
  return output;
}

function minifyCss(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*([{}:;,>])\s*/g, '$1')
    .trim();
}

function rewriteRoutes(source) {
  let output = source;
  const entries = Object.entries(routeAliases).sort((a, b) => b[0].length - a[0].length);
  for (const [from, to] of entries) {
    output = output.split(from).join(to);
  }
  return output;
}

async function processAsset(filePath) {
  const ext = path.extname(filePath);
  if (!textExtensions.has(ext) && ext !== '.html') return;

  const relative = '/' + path.relative(publicDir, filePath).split(path.sep).join('/');
  const source = rewriteRoutes(await readFile(filePath, 'utf8'));
  if (ext === '.html') {
    await writeFile(filePath, source);
    return;
  }
  const hardened = ext === '.js' ? obfuscateJavaScript(source) : minifyCss(source);
  const hash = hashContent(hardened);
  const dir = path.dirname(filePath);
  const base = path.basename(filePath, ext);
  const hashedName = `${base}.${hash}${ext}`;
  const hashedPath = path.join(dir, hashedName);
  const hashedRelative = '/' + path.relative(publicDir, hashedPath).split(path.sep).join('/');

  await writeFile(filePath, hardened);
  await rename(filePath, hashedPath);
  manifest[relative] = hashedRelative;
}

function rewriteReferences(html) {
  let nextHtml = html;
  for (const [from, to] of Object.entries(manifest)) {
    const fromEscaped = from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    nextHtml = nextHtml.replace(new RegExp(`${fromEscaped}(?:\\?v=[^"']*)?`, 'g'), to);
  }
  return nextHtml;
}

async function main() {
  const rootInfo = await stat(publicDir);
  if (!rootInfo.isDirectory()) throw new Error(`${publicDir} is not a directory`);

  const files = await walk(publicDir);
  for (const file of files) {
    await processAsset(file);
  }

  const indexPath = path.join(publicDir, 'index.html');
  const indexHtml = await readFile(indexPath, 'utf8');
  await writeFile(indexPath, rewriteReferences(indexHtml));
  await writeFile(path.join(publicDir, 'asset-manifest.json'), JSON.stringify(manifest, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});

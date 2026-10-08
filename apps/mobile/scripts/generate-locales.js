const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname, '..', 'src', 'i18n', 'locales');

// We load the append dictionaries
const appends = require('./all-appends.js');

const files = ['en', 'fr', 'it', 'de', 'es', 'ptBR', 'tr', 'pl', 'id', 'ar'];

for (const code of files) {
  const filePath = path.join(localesDir, `${code}.ts`);
  let content = fs.readFileSync(filePath, 'utf8');

  const additions = appends[code];
  if (!additions) {
    console.error(`Missing additions for ${code}`);
    continue;
  }

  // Format new lines
  const lines = Object.entries(additions).map(([k, v]) => {
    // Escape single quotes in value
    const escaped = v.replace(/'/g, "\\'");
    return `  '${k}': '${escaped}',`;
  });

  const block = `\n  // Extended translations\n` + lines.join('\n') + '\n';

  if (code === 'en') {
    // Insert before "} as const;"
    const target = '} as const;';
    if (!content.includes(target)) {
      console.error(`Could not find target in en.ts`);
      continue;
    }
    content = content.replace(target, block + target);
  } else {
    // Insert before "};"
    const target = '};';
    const lastIdx = content.lastIndexOf(target);
    if (lastIdx === -1) {
      console.error(`Could not find target in ${code}.ts`);
      continue;
    }
    content = content.slice(0, lastIdx) + block + content.slice(lastIdx);
  }

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Updated ${code}.ts successfully.`);
}

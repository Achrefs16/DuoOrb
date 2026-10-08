const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname, '..', 'src', 'i18n', 'locales');

const additions = {
  en: {
    'profile.noBlockedUsers': 'No blocked users',
    'profile.peak': 'Peak',
    'profile.now': 'Now',
    'legal.webVersion': 'Web version (Play listing URL)',
    'legal.openWeb': 'Open web version',
  },
  fr: {
    'profile.noBlockedUsers': 'Aucun utilisateur bloqué',
    'profile.peak': 'Pic',
    'profile.now': 'Maintenant',
    'legal.webVersion': 'Version web (URL fiche Play)',
    'legal.openWeb': 'Ouvrir la version web',
  },
  it: {
    'profile.noBlockedUsers': 'Nessun utente bloccato',
    'profile.peak': 'Picco',
    'profile.now': 'Ora',
    'legal.webVersion': 'Versione web (URL scheda Play)',
    'legal.openWeb': 'Apri versione web',
  },
  de: {
    'profile.noBlockedUsers': 'Keine blockierten Benutzer',
    'profile.peak': 'Spitze',
    'profile.now': 'Jetzt',
    'legal.webVersion': 'Web-Version (Play Store-URL)',
    'legal.openWeb': 'Web-Version öffnen',
  },
  es: {
    'profile.noBlockedUsers': 'No hay usuarios bloqueados',
    'profile.peak': 'Pico',
    'profile.now': 'Ahora',
    'legal.webVersion': 'Versión web (URL de Play Store)',
    'legal.openWeb': 'Abrir versión web',
  },
  ptBR: {
    'profile.noBlockedUsers': 'Nenhum usuário bloqueado',
    'profile.peak': 'Pico',
    'profile.now': 'Agora',
    'legal.webVersion': 'Versão web (URL do Play Store)',
    'legal.openWeb': 'Abrir versão web',
  },
  tr: {
    'profile.noBlockedUsers': 'Engellenen kullanıcı yok',
    'profile.peak': 'Zirve',
    'profile.now': 'Şimdi',
    'legal.webVersion': 'Web sürümü (Play listesi URL)',
    'legal.openWeb': 'Web sürümünü aç',
  },
  pl: {
    'profile.noBlockedUsers': 'Brak zablokowanych użytkowników',
    'profile.peak': 'Szczyt',
    'profile.now': 'Teraz',
    'legal.webVersion': 'Wersja internetowa (URL Play)',
    'legal.openWeb': 'Otwórz wersję internetową',
  },
  id: {
    'profile.noBlockedUsers': 'Tidak ada pengguna yang diblokir',
    'profile.peak': 'Puncak',
    'profile.now': 'Sekarang',
    'legal.webVersion': 'Versi web (URL listing Play)',
    'legal.openWeb': 'Buka versi web',
  },
  ar: {
    'profile.noBlockedUsers': 'لا يوجد مستخدمون محظورون',
    'profile.peak': 'الذروة',
    'profile.now': 'الآن',
    'legal.webVersion': 'إصدار الويب (رابط متجر Play)',
    'legal.openWeb': 'فتح إصدار الويب',
  },
};

const files = {
  en: 'en.ts',
  fr: 'fr.ts',
  it: 'it.ts',
  de: 'de.ts',
  es: 'es.ts',
  ptBR: 'ptBR.ts',
  tr: 'tr.ts',
  pl: 'pl.ts',
  id: 'id.ts',
  ar: 'ar.ts',
};

for (const [lang, filename] of Object.entries(files)) {
  const filePath = path.join(localesDir, filename);
  let content = fs.readFileSync(filePath, 'utf8');
  
  const entries = additions[lang];
  let injection = '\n  // Final Polish Additions\n';
  for (const [k, v] of Object.entries(entries)) {
    const escapedVal = v.replace(/'/g, "\\'");
    injection += `  '${k}': '${escapedVal}',\n`;
  }

  if (lang === 'en') {
    content = content.replace(/\n\} as const;/, `${injection}} as const;`);
  } else {
    content = content.replace(/\n\};/, `${injection}};`);
  }

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Updated ${filename}`);
}

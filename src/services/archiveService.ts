import { Comic, Publisher } from '../types/comic';

// Heuristics for detecting Publisher & Main Superhero from titles and descriptions
export function detectPublisherAndHero(text: string): { publisher: Publisher; hero: string } {
  const lower = text.toLowerCase();

  // DC Heroes & Keywords
  const dcHeroes = [
    { name: 'Batman', regex: /\b(batman|caballero oscuro|dark knight|gotham|joker|bruce wayne|nightwing|robin)\b/ },
    { name: 'Superman', regex: /\b(superman|clark kent|krypton|metropolis|hombre de acero|man of steel)\b/ },
    { name: 'Wonder Woman', regex: /\b(wonder woman|mujer maravilla|diana prince|themyscira)\b/ },
    { name: 'The Flash', regex: /\b(flash|barry allen|wally west|speed force|central city)\b/ },
    { name: 'Green Lantern', regex: /\b(green lantern|linterna verde|hal jordan|john stewart)\b/ },
    { name: 'Aquaman', regex: /\b(aquaman|arthur curry|atlantis)\b/ },
    { name: 'Liga de la Justicia', regex: /\b(justice league|liga de la justicia|jla)\b/ },
    { name: 'DC Comics', regex: /\b(dc comics|detective comics|action comics|vertigo)\b/ }
  ];

  // Marvel Heroes & Keywords
  const marvelHeroes = [
    { name: 'Spider-Man', regex: /\b(spiderman|spider-man|peter parker|miles morales|trepamuros|venom|carnage)\b/ },
    { name: 'X-Men', regex: /\b(x-men|mutantes|wolverine|lobezno|magneto|profesor x|ciclope|cyclops|rogue)\b/ },
    { name: 'Avengers', regex: /\b(avengers|vengadores|capit[aá]n am[eé]rica|captain america|iron man|thor|hulk|black widow|hawkeye)\b/ },
    { name: 'Deadpool', regex: /\b(deadpool|masacre|wade wilson)\b/ },
    { name: 'Daredevil', regex: /\b(daredevil|matt murdock|hell's kitchen|el hombre sin miedo)\b/ },
    { name: 'Fantastic Four', regex: /\b(fantastic four|4 fant[aá]sticos|los cuatro fantasticos|reed richards)\b/ },
    { name: 'Marvel Comics', regex: /\b(marvel|stan lee|jack kirby|mcu)\b/ }
  ];

  for (const hero of dcHeroes) {
    if (hero.regex.test(lower)) {
      return { publisher: 'DC', hero: hero.name };
    }
  }

  for (const hero of marvelHeroes) {
    if (hero.regex.test(lower)) {
      return { publisher: 'Marvel', hero: hero.name };
    }
  }

  // Fallback checks
  if (lower.includes('dc') || lower.includes('novaro') || lower.includes('zinco') || lower.includes('ecc')) {
    return { publisher: 'DC', hero: 'DC Universe' };
  }
  if (lower.includes('marvel') || lower.includes('panini') || lower.includes('forum') || lower.includes('vertice')) {
    return { publisher: 'Marvel', hero: 'Marvel Universe' };
  }

  return { publisher: 'Other', hero: 'Cómic' };
}

export async function searchComicsOnline(
  userQuery: string,
  publisherFilter: Publisher = 'Other'
): Promise<Comic[]> {
  try {
    // Build query prioritizing Spanish DC/Marvel comics
    const spanishFilter = '(language:spa OR language:Spanish OR espanol OR castellano OR "en español" OR "novaro" OR "zinco" OR "panini" OR "forum" OR "bruguera")';
    
    let baseQuery = userQuery.trim();
    if (!baseQuery) {
      baseQuery = 'batman OR spiderman OR superman OR avengers OR "x-men" OR deadpool';
    }

    // Publisher specific filtering
    let pubQuery = '';
    if (publisherFilter === 'DC') {
      pubQuery = ' AND (DC OR Batman OR Superman OR "Justice League" OR "Green Lantern" OR Flash)';
    } else if (publisherFilter === 'Marvel') {
      pubQuery = ' AND (Marvel OR Spiderman OR "Spider-Man" OR X-Men OR Avengers OR Deadpool OR "Iron Man")';
    }

    const fullQuery = `mediatype:texts AND (${baseQuery}) ${pubQuery} AND ${spanishFilter}`;

    const params = new URLSearchParams({
      q: fullQuery,
      'fl[]': 'identifier,title,year,description,downloads,imagecount,creator',
      'sort[]': 'downloads desc',
      rows: '35',
      output: 'json'
    });

    const response = await fetch(`https://archive.org/advancedsearch.php?${params.toString()}`);
    if (!response.ok) {
      throw new Error(`Archive.org API responded with status ${response.status}`);
    }

    const data = await response.json();
    const docs = data.response?.docs || [];

    const comics: Comic[] = docs
      .filter((doc: any) => {
        // Exclude unwanted items like government documents or non-comics
        const title = (doc.title || '').toLowerCase();
        const badKeywords = ['cia-rdp', 'gazette', 'hearing', 'manual', 'report', 'senate', 'quran', 'roms'];
        return !badKeywords.some(bad => title.includes(bad));
      })
      .map((doc: any) => {
        const title = doc.title || 'Cómic sin título';
        const description = Array.isArray(doc.description) 
          ? doc.description.join(' ') 
          : (doc.description || 'Cómic en español publicado en internet.');
        
        const { publisher, hero } = detectPublisherAndHero(`${title} ${description}`);
        const identifier = doc.identifier;
        
        // Estimation or extraction of total pages
        let totalPages = parseInt(doc.imagecount, 10);
        if (isNaN(totalPages) || totalPages <= 0) {
          totalPages = 32; // Standard default comic issue size
        }

        return {
          id: identifier,
          identifier,
          title,
          publisher,
          hero,
          year: doc.year || 'Clásico',
          language: 'Español',
          coverUrl: `https://archive.org/services/img/${identifier}`,
          description: description.replace(/<[^>]*>?/gm, '').slice(0, 240) + '...',
          source: 'archive',
          totalPages
        };
      });

    return comics;
  } catch (error) {
    console.error('Error searching comics online:', error);
    return [];
  }
}

// Fetch exact metadata for a given comic identifier to know exact pages and available formats
export async function fetchComicDetails(identifier: string): Promise<{ totalPages: number; pageUrls: string[]; pdfUrl?: string; cbzUrl?: string }> {
  try {
    const res = await fetch(`https://archive.org/metadata/${identifier}`);
    if (!res.ok) throw new Error('Failed to fetch metadata');
    
    const data = await res.json();
    const files = data.files || [];
    const metadata = data.metadata || {};

    let totalPages = parseInt(metadata.imagecount, 10);
    let pdfUrl: string | undefined;
    let cbzUrl: string | undefined;

    for (const f of files) {
      const name = f.name || '';
      if (!totalPages && f.imagecount) {
        totalPages = parseInt(f.imagecount, 10);
      }
      if (name.endsWith('.pdf') && !pdfUrl) {
        pdfUrl = `https://archive.org/download/${identifier}/${encodeURIComponent(name)}`;
      }
      if (name.endsWith('.cbz') || name.endsWith('.cbr')) {
        if (!cbzUrl) {
          cbzUrl = `https://archive.org/download/${identifier}/${encodeURIComponent(name)}`;
        }
      }
    }

    if (!totalPages || isNaN(totalPages) || totalPages < 1) {
      totalPages = 32;
    }

    // Generate page image URLs for the Archive.org BookReader / Single Page Image Service
    const pageUrls: string[] = [];
    for (let i = 0; i < totalPages; i++) {
      pageUrls.push(`https://archive.org/download/${identifier}/page/n${i}.jpg`);
    }

    return { totalPages, pageUrls, pdfUrl, cbzUrl };
  } catch (err) {
    console.error(`Error loading comic details for ${identifier}:`, err);
    // Fallback: 32 pages generator
    const pageUrls: string[] = [];
    for (let i = 0; i < 32; i++) {
      pageUrls.push(`https://archive.org/download/${identifier}/page/n${i}.jpg`);
    }
    return { totalPages: 32, pageUrls };
  }
}

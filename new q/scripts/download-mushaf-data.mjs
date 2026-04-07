import { promises as fs } from "node:fs";
import path from "node:path";

const PAGE_LAYOUT_WORD_FIELDS =
  "verse_key,position,text_uthmani,text_qpc_hafs,code_v2,char_type_name,page_number,line_number,v2_page,line_v2";
const API_BASE = (process.env.MUSHAF_DOWNLOAD_API_BASE || "https://api.quran.com/api/v4").replace(/\/$/, "");
const TOTAL_PAGES = 604;
const TOTAL_RUBS = 240;

function parseArg(name, fallback) {
  const prefix = `--${name}=`;
  const value = process.argv.slice(2).find((entry) => entry.startsWith(prefix));
  return value ? value.slice(prefix.length).trim() : fallback;
}

function toInt(value, fallback = 0) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isInteger(parsed) ? parsed : fallback;
}

function clampInt(value, min, max, fallback) {
  const parsed = toInt(value, fallback);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function parseVerseKey(verseKey) {
  const normalized = String(verseKey || "").trim();
  if (!normalized.includes(":")) {
    return { chapterId: 0, verseNumber: 0 };
  }

  const [chapterRaw, verseRaw] = normalized.split(":", 2);
  return {
    chapterId: toInt(chapterRaw, 0),
    verseNumber: toInt(verseRaw, 0)
  };
}

function normalizeWord(rawWord, verseKey, fallbackPage) {
  const pageNumber = clampInt(rawWord?.page_number, 1, TOTAL_PAGES, fallbackPage);

  return {
    position: clampInt(rawWord?.position, 1, 500, 1),
    verse_key: String(rawWord?.verse_key || verseKey),
    char_type_name: String(rawWord?.char_type_name || ""),
    text_uthmani: String(rawWord?.text_uthmani || ""),
    text_qpc_hafs: String(rawWord?.text_qpc_hafs || ""),
    text: String(rawWord?.text || rawWord?.text_uthmani || ""),
    code_v2: String(rawWord?.code_v2 || ""),
    page_number: pageNumber,
    line_number: clampInt(rawWord?.line_number, 1, 100, 1),
    v2_page: clampInt(rawWord?.v2_page, 1, TOTAL_PAGES, pageNumber),
    line_v2: clampInt(rawWord?.line_v2, 1, 100, 1)
  };
}

function normalizeVerse(rawVerse, fallbackPage) {
  const verseKey = String(rawVerse?.verse_key || "").trim();
  const parsedVerseKey = parseVerseKey(verseKey);

  const pageNumber = clampInt(rawVerse?.page_number, 1, TOTAL_PAGES, fallbackPage);
  const verseNumber = clampInt(rawVerse?.verse_number, 1, 500, parsedVerseKey.verseNumber || 1);
  const chapterId = clampInt(rawVerse?.chapter_id, 1, 114, parsedVerseKey.chapterId || 1);

  const words = Array.isArray(rawVerse?.words)
    ? rawVerse.words.map((rawWord) => normalizeWord(rawWord, verseKey, pageNumber))
    : [];

  return {
    id: clampInt(rawVerse?.id, 1, 999_999, (chapterId - 1) * 1000 + verseNumber),
    verse_number: verseNumber,
    verse_key: verseKey || `${chapterId}:${verseNumber}`,
    hizb_number: clampInt(rawVerse?.hizb_number, 1, 60, 1),
    rub_el_hizb_number: clampInt(rawVerse?.rub_el_hizb_number, 1, TOTAL_RUBS, 1),
    ruku_number: clampInt(rawVerse?.ruku_number, 1, 1000, 1),
    manzil_number: clampInt(rawVerse?.manzil_number, 1, 7, 1),
    sajdah_number:
      rawVerse?.sajdah_number === null || rawVerse?.sajdah_number === undefined
        ? null
        : clampInt(rawVerse?.sajdah_number, 1, 1000, 1),
    text_uthmani: String(rawVerse?.text_uthmani || ""),
    page_number: pageNumber,
    juz_number: clampInt(rawVerse?.juz_number, 1, 30, 1),
    chapter_id: chapterId,
    words
  };
}

async function fetchJsonWithRetry(url, retries) {
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          Accept: "application/json"
        },
        cache: "no-store"
      });

      if (response.ok) {
        return await response.json();
      }

      if (attempt >= retries) {
        throw new Error(`Request failed with status ${response.status}`);
      }
    } catch (error) {
      if (attempt >= retries) {
        throw error;
      }
    }

    await sleep((attempt + 1) * 400);
  }

  throw new Error("Unreachable retry state.");
}

async function fetchPageVerses(pageNumber, retries) {
  const verses = [];
  let apiPage = 1;

  while (true) {
    const endpoint =
      `${API_BASE}/verses/by_page/${pageNumber}` +
      `?fields=text_uthmani&mushaf=1&words=true&word_fields=${encodeURIComponent(PAGE_LAYOUT_WORD_FIELDS)}` +
      `&per_page=50&page=${apiPage}`;

    const payload = await fetchJsonWithRetry(endpoint, retries);
    const currentVerses = Array.isArray(payload?.verses) ? payload.verses : [];

    verses.push(...currentVerses.map((rawVerse) => normalizeVerse(rawVerse, pageNumber)));

    const nextPage = toInt(payload?.pagination?.next_page, 0);
    if (!nextPage || nextPage === apiPage) {
      break;
    }

    apiPage = nextPage;
  }

  return verses;
}

async function mapWithConcurrency(items, concurrency, mapper) {
  if (!items.length) return [];

  const safeConcurrency = Math.max(1, Math.min(concurrency, items.length));
  const results = new Array(items.length);
  let nextIndex = 0;

  const workers = Array.from({ length: safeConcurrency }, async () => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  });

  await Promise.all(workers);
  return results;
}

function buildRubsFromPages(pages) {
  const rubBuckets = Object.fromEntries(Array.from({ length: TOTAL_RUBS }, (_, index) => [String(index + 1), []]));

  for (let pageNumber = 1; pageNumber <= TOTAL_PAGES; pageNumber += 1) {
    const verses = pages[String(pageNumber)] || [];

    for (const verse of verses) {
      const rubNumber = clampInt(verse.rub_el_hizb_number, 1, TOTAL_RUBS, 1);
      rubBuckets[String(rubNumber)].push(verse);
    }
  }

  return rubBuckets;
}

async function run() {
  const outputArg = parseArg("output", "../quran_offline.json");
  const retries = clampInt(parseArg("retries", "3"), 0, 10, 3);
  const concurrency = clampInt(parseArg("concurrency", "6"), 1, 24, 6);
  const outputPath = path.resolve(process.cwd(), outputArg);

  console.log(`[mushaf-download] API base: ${API_BASE}`);
  console.log(`[mushaf-download] Output file: ${outputPath}`);
  console.log(`[mushaf-download] Concurrency: ${concurrency}, retries: ${retries}`);

  const pageNumbers = Array.from({ length: TOTAL_PAGES }, (_, index) => index + 1);
  let completedPages = 0;

  const pageResults = await mapWithConcurrency(pageNumbers, concurrency, async (pageNumber) => {
    const verses = await fetchPageVerses(pageNumber, retries);
    completedPages += 1;

    if (completedPages % 25 === 0 || completedPages === TOTAL_PAGES) {
      console.log(`[mushaf-download] Downloaded ${completedPages}/${TOTAL_PAGES} pages`);
    }

    return verses;
  });

  const pages = Object.fromEntries(pageNumbers.map((pageNumber, index) => [String(pageNumber), pageResults[index]]));
  const rubs = buildRubsFromPages(pages);
  const verseSequence = pageNumbers
    .flatMap((pageNumber) => pages[String(pageNumber)] || [])
    .map((verse) => String(verse.verse_key || "").trim())
    .filter(Boolean);

  const payload = {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    source: `${API_BASE}/verses/by_page/{page}`,
    pages,
    rubs,
    verse_sequence: verseSequence
  };

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(payload), "utf8");

  const stats = await fs.stat(outputPath);
  const sizeInMb = (stats.size / (1024 * 1024)).toFixed(2);

  console.log(`[mushaf-download] Saved ${TOTAL_PAGES} pages and ${TOTAL_RUBS} rubs (${sizeInMb} MB).`);
}

run().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[mushaf-download] Failed: ${message}`);
  process.exitCode = 1;
});

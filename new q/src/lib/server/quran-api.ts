import type {
  AppStatusPayload,
  ChapterIndexPayload,
  PageRecitationPayload,
  PageWordTimingsPayload,
  PaginatedVersesResponse,
  RecitationsPayload,
  RubResponse,
  RubRecitationPayload,
  RubWordTimingsPayload,
  TafsirPayload,
  VerseSequencePayload,
  VerseAudioResponse,
  QuranVerse,
  VerseWordTiming
} from "@/lib/types/quran";
import {
  getDownloadedMushafData,
  getDownloadedPageVerses,
  getDownloadedRubVerses,
  hasDownloadedMushafData
} from "@/lib/server/downloaded-mushaf";
import { buildVisibleVerseKeysByPage, getDistinctQcfPageNumbers } from "@/lib/utils/mushaf-layout";
import { clampInt } from "@/lib/utils/normalizers";

const OAUTH_ENDPOINT = process.env.OAUTH_ENDPOINT?.trim() || "";
const CLIENT_ID = process.env.CLIENT_ID?.trim() || "";
const CLIENT_SECRET = process.env.CLIENT_SECRET?.trim() || "";
const DEFAULT_TAFSIR_ID = process.env.DEFAULT_TAFSIR_ID?.trim() || "";
const PAGE_LAYOUT_WORD_FIELDS =
  "verse_key,position,text_uthmani,text_qpc_hafs,code_v2,char_type_name,page_number,line_number,v2_page,line_v2";

interface ApiFetchOptions {
  timeoutMs?: number;
}

type RecitationResource = {
  id?: number;
  reciter_name?: string;
  style?: string;
  translated_name?: {
    name?: string;
    language_name?: string;
  };
};

type TafsirResource = {
  id?: number;
  language_name?: string;
  translated_name?: {
    language_name?: string;
  };
};

let oauthToken = "";
let oauthTokenExpiry = 0;
let oauthTokenInFlight: Promise<string | null> | null = null;

let recitationsCache: RecitationResource[] | null = null;
let recitationsFetchInFlight: Promise<void> | null = null;
let tafsirResourcesCache: TafsirResource[] | null = null;
const chapterTimingsCache = new Map<string, Record<string, VerseWordTiming>>();
let chapterIndexCache: ChapterIndexPayload | null = null;
let chapterIndexInFlight: Promise<ChapterIndexPayload> | null = null;
let verseSequenceCache: VerseSequencePayload | null = null;

const RECITATIONS_FALLBACK_LIST: RecitationsPayload["recitations"] = [
  {
    id: 8,
    name: "محمد صديق المنشاوي",
    style: "Mujawwad",
    label: "محمد صديق المنشاوي - Mujawwad"
  },
  {
    id: 2,
    name: "عبد الباسط عبد الصمد",
    style: "Murattal",
    label: "عبد الباسط عبد الصمد - Murattal"
  },
  {
    id: 1,
    name: "عبد الباسط عبد الصمد",
    style: "Mujawwad",
    label: "عبد الباسط عبد الصمد - Mujawwad"
  },
  {
    id: 4,
    name: "أبو بكر الشاطرى",
    style: "",
    label: "أبو بكر الشاطرى"
  },
  {
    id: 5,
    name: "هاني الرفاعي",
    style: "",
    label: "هاني الرفاعي"
  },
  {
    id: 12,
    name: "محمود خليل الحصري",
    style: "Muallim",
    label: "محمود خليل الحصري - Muallim"
  },
  {
    id: 6,
    name: "محمود خليل الحصري",
    style: "",
    label: "محمود خليل الحصري"
  },
  {
    id: 7,
    name: "مشاري راشد العفاسي",
    style: "",
    label: "مشاري راشد العفاسي"
  },
  {
    id: 10,
    name: "سعود الشريم",
    style: "",
    label: "سعود الشريم"
  },
  {
    id: 11,
    name: "محمد الطبلاوي",
    style: "",
    label: "محمد الطبلاوي"
  },
  {
    id: 3,
    name: "عبدالرحمن السديس",
    style: "",
    label: "عبدالرحمن السديس"
  },
  {
    id: 9,
    name: "محمد صديق المنشاوي",
    style: "Murattal",
    label: "محمد صديق المنشاوي - Murattal"
  }
];

function hasApiConfig() {
  return Boolean(OAUTH_ENDPOINT && CLIENT_ID && CLIENT_SECRET);
}

function parseJsonSafely<T>(raw: string) {
  return JSON.parse(raw) as T;
}

function toSortedUniqueNumbers(values: number[]) {
  return [...new Set(values.filter((value) => Number.isFinite(value) && value > 0))].sort((left, right) => left - right);
}

function buildRange(start: number, end: number) {
  if (start <= 0 || end <= 0) return [];
  if (end < start) return [start];
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

function buildPageRange(pages: number[]) {
  const start = clampInt(pages?.[0], 1, 604, 0);
  const end = clampInt(pages?.[1] ?? pages?.[0], start || 1, 604, 0);
  if (!start || !end) return [];
  return buildRange(start, end);
}

async function mapWithConcurrency<T, R>(items: T[], concurrency: number, mapper: (item: T) => Promise<R>) {
  if (!items.length) return [] as R[];

  const limit = Math.max(1, Math.min(concurrency, items.length));
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  const workers = Array.from({ length: limit }, async () => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(items[currentIndex]);
    }
  });

  await Promise.all(workers);
  return results;
}

async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = 15_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
      cache: "no-store"
    });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchOAuthToken() {
  if (!hasApiConfig()) return null;

  const now = Date.now();
  if (oauthToken && now < oauthTokenExpiry - 60_000) {
    return oauthToken;
  }

  if (!oauthTokenInFlight) {
    oauthTokenInFlight = (async () => {
      const endpoint = `${OAUTH_ENDPOINT.replace(/\/$/, "")}/oauth2/token`;
      const basicAuth = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");

      const response = await fetchWithTimeout(
        endpoint,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${basicAuth}`,
            "Content-Type": "application/x-www-form-urlencoded"
          },
          body: new URLSearchParams({
            grant_type: "client_credentials",
            scope: "content"
          }).toString()
        },
        30_000
      );

      if (!response.ok) {
        throw new Error(`OAuth token request failed: ${response.status}`);
      }

      const payload = parseJsonSafely<{ access_token?: string; expires_in?: number }>(await response.text());
      const token = String(payload.access_token || "").trim();
      if (!token) {
        throw new Error("OAuth token response missing access_token");
      }

      oauthToken = token;
      oauthTokenExpiry = Date.now() + Math.max(300, Number(payload.expires_in || 3600)) * 1000;
      return token;
    })().finally(() => {
      oauthTokenInFlight = null;
    });
  }

  try {
    return await oauthTokenInFlight;
  } catch {
    oauthToken = "";
    oauthTokenExpiry = 0;
    return null;
  }
}

async function fetchApiJson<T>(url: string, options?: ApiFetchOptions) {
  if (!hasApiConfig()) return null;

  const token = await fetchOAuthToken();
  if (!token) return null;

  try {
    const response = await fetchWithTimeout(
      url,
      {
        headers: {
          "x-auth-token": token,
          "x-client-id": CLIENT_ID
        }
      },
      options?.timeoutMs ?? 15_000
    );

    if (!response.ok) return null;
    return parseJsonSafely<T>(await response.text());
  } catch {
    return null;
  }
}

async function fetchPublicApiJson<T>(url: string, options?: ApiFetchOptions) {
  try {
    const response = await fetchWithTimeout(url, {}, options?.timeoutMs ?? 15_000);
    if (!response.ok) return null;
    return parseJsonSafely<T>(await response.text());
  } catch {
    return null;
  }
}

function apiV4(pathname: string) {
  return `https://apis.quran.foundation/content/api/v4/${pathname.replace(/^\//, "")}`;
}

function publicApiV4(pathname: string) {
  return `https://api.quran.com/api/v4/${pathname.replace(/^\//, "")}`;
}

export function extractTafsirPlainText(rawText: string) {
  const normalized = String(rawText || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p\s*>/gi, "\n\n")
    .replace(/<\/h[1-6]\s*>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n");

  return normalized.trim();
}

function normalizeAudioUrl(url: unknown) {
  const normalized = String(url || "").trim();
  if (!normalized) return "";
  if (normalized.startsWith("http://") || normalized.startsWith("https://")) return normalized;
  return `https://verses.quran.foundation/${normalized.replace(/^\/+/, "")}`;
}

function parseVerseKey(verseKey: string) {
  const normalized = String(verseKey || "").trim();
  if (!normalized.includes(":")) return null;
  const [chapterRaw, verseRaw] = normalized.split(":", 2);
  const chapter = Number.parseInt(chapterRaw || "", 10);
  const verse = Number.parseInt(verseRaw || "", 10);
  if (!Number.isInteger(chapter) || !Number.isInteger(verse)) return null;
  return { chapter, verse };
}

function toCanonicalVerseKey(verseKey: string) {
  const parsed = parseVerseKey(verseKey);
  if (!parsed) return "";
  return `${parsed.chapter}:${parsed.verse}`;
}

function parseChapterNumber(verseKey: string) {
  return parseVerseKey(verseKey)?.chapter ?? 0;
}

function getTafsirFallbackCandidateIds(tafsirId: number) {
  const candidates = [tafsirId];

  if (!hasApiConfig() && tafsirId === 925) {
    // Legacy Tanweer ID is unavailable on the public API; fallback to Muyassar.
    candidates.push(16);
  }

  if (tafsirId !== 16) {
    // Ensure tafsir route remains available even when a specific source has sparse verse coverage.
    candidates.push(16);
  }

  return [...new Set(candidates)];
}

async function fetchPaginatedVerses(basePath: string, fallbackToPublic = true) {
  const verses: unknown[] = [];
  let page = 1;

  while (true) {
    const separator = basePath.includes("?") ? "&" : "?";
    const apiPath = `${basePath}${separator}page=${page}&per_page=50`;
    const apiResult = await fetchApiJson<{ verses?: unknown[]; pagination?: { next_page?: number | null } }>(apiV4(apiPath));
    const result =
      apiResult ||
      (fallbackToPublic
        ? await fetchPublicApiJson<{ verses?: unknown[]; pagination?: { next_page?: number | null } }>(publicApiV4(apiPath))
        : null);

    if (!result) return null;

    verses.push(...(result.verses || []));
    const nextPage = Number(result.pagination?.next_page || 0);
    if (!nextPage || nextPage === page) break;
    page = nextPage;
  }

  return verses;
}

function ensureTafsirId(candidate: unknown) {
  const parsed = Number.parseInt(String(candidate ?? ""), 10);
  if (Number.isInteger(parsed) && parsed > 0) return parsed;
  return null;
}

async function resolveDefaultTafsirId() {
  const fromEnv = ensureTafsirId(DEFAULT_TAFSIR_ID);
  if (fromEnv) return fromEnv;

  if (!tafsirResourcesCache) {
    const endpoint = "resources/tafsirs?language=ar";
    const payload = (await fetchApiJson<{ tafsirs?: TafsirResource[] }>(apiV4(endpoint))) ||
      (await fetchPublicApiJson<{ tafsirs?: TafsirResource[] }>(publicApiV4(endpoint)));
    tafsirResourcesCache = payload?.tafsirs || [];
  }

  if (!tafsirResourcesCache.length) return null;

  const arabicCandidate = tafsirResourcesCache.find((tafsir) => {
    const languageName = String(tafsir.language_name || "").toLowerCase();
    const translatedLanguage = String(tafsir.translated_name?.language_name || "").toLowerCase();
    return languageName.includes("arab") || translatedLanguage.includes("arab");
  });

  return ensureTafsirId(arabicCandidate?.id) || ensureTafsirId(tafsirResourcesCache[0]?.id);
}

function getDefaultRecitationId() {
  return 7;
}

async function fetchRubRecitationAudioFiles(recitationId: number, rubNumber: number) {
  const audioFiles: Array<{ verse_key: string; url: string }> = [];
  let page = 1;

  while (true) {
    const endpoint = `recitations/${recitationId}/by_rub_el_hizb/${rubNumber}?page=${page}&per_page=50`;
    const payload = (await fetchApiJson<{
      audio_files?: Array<{ verse_key?: string; url?: string }>;
      pagination?: { next_page?: number | null };
    }>(apiV4(endpoint))) ||
      (await fetchPublicApiJson<{
        audio_files?: Array<{ verse_key?: string; url?: string }>;
        pagination?: { next_page?: number | null };
      }>(publicApiV4(endpoint)));

    if (!payload) return null;

    for (const file of payload.audio_files || []) {
      const verseKey = String(file.verse_key || "").trim();
      const url = normalizeAudioUrl(file.url);
      if (!verseKey || !url) continue;
      audioFiles.push({ verse_key: verseKey, url });
    }

    const nextPage = Number(payload.pagination?.next_page || 0);
    if (!nextPage || nextPage === page) break;
    page = nextPage;
  }

  return audioFiles;
}

async function fetchPageRecitationAudioFiles(recitationId: number, pageNumber: number) {
  const audioFiles: Array<{ verse_key: string; url: string }> = [];
  let page = 1;

  while (true) {
    const endpoint = `recitations/${recitationId}/by_page/${pageNumber}?page=${page}&per_page=50`;
    const payload = (await fetchApiJson<{
      audio_files?: Array<{ verse_key?: string; url?: string }>;
      pagination?: { next_page?: number | null };
    }>(apiV4(endpoint))) ||
      (await fetchPublicApiJson<{
        audio_files?: Array<{ verse_key?: string; url?: string }>;
        pagination?: { next_page?: number | null };
      }>(publicApiV4(endpoint)));

    if (!payload) return null;

    for (const file of payload.audio_files || []) {
      const verseKey = String(file.verse_key || "").trim();
      const url = normalizeAudioUrl(file.url);
      if (!verseKey || !url) continue;
      audioFiles.push({ verse_key: verseKey, url });
    }

    const nextPage = Number(payload.pagination?.next_page || 0);
    if (!nextPage || nextPage === page) break;
    page = nextPage;
  }

  return audioFiles;
}

async function fetchChapterRecitationSegments(recitationId: number, chapterNumber: number) {
  const cacheKey = `${recitationId}:${chapterNumber}`;
  if (chapterTimingsCache.has(cacheKey)) {
    return chapterTimingsCache.get(cacheKey) || null;
  }

  const endpoint = `chapter_recitations/${recitationId}/${chapterNumber}?segments=true`;
  const payload = (await fetchApiJson<{
    audio_file?: {
      timestamps?: Array<{
        verse_key?: string;
        timestamp_from?: number;
        timestamp_to?: number;
        segments?: Array<[number, number, number]>;
      }>;
    };
  }>(apiV4(endpoint))) ||
    (await fetchPublicApiJson<{
      audio_file?: {
        timestamps?: Array<{
          verse_key?: string;
          timestamp_from?: number;
          timestamp_to?: number;
          segments?: Array<[number, number, number]>;
        }>;
      };
    }>(publicApiV4(endpoint)));

  if (!payload) return null;

  const verseTimings: Record<string, VerseWordTiming> = {};
  for (const entry of payload.audio_file?.timestamps || []) {
    const verseKey = String(entry.verse_key || "").trim();
    if (!verseKey) continue;

    const verseStart = clampInt(entry.timestamp_from, 0, 99_999_999, 0);
    const verseEnd = clampInt(entry.timestamp_to, verseStart, 99_999_999, verseStart);
    const segments = (entry.segments || [])
      .map((segment) => {
        const position = clampInt(segment?.[0], 0, 10_000, 0);
        const startMs = Math.max(0, clampInt(segment?.[1], 0, 99_999_999, 0) - verseStart);
        const endMs = Math.max(startMs, clampInt(segment?.[2], 0, 99_999_999, 0) - verseStart);
        return {
          position,
          start_ms: startMs,
          end_ms: endMs
        };
      })
      .filter((segment) => segment.position > 0);

    verseTimings[verseKey] = {
      verse_start_ms: verseStart,
      verse_end_ms: verseEnd,
      segments
    };
  }

  chapterTimingsCache.set(cacheKey, verseTimings);
  return verseTimings;
}

async function fetchRubVerses(rubNumber: number) {
  const normalizedRub = clampInt(rubNumber, 1, 240, 1);
  const downloadedRubVerses = await getDownloadedRubVerses(normalizedRub);
  if (downloadedRubVerses?.length) {
    return downloadedRubVerses;
  }

  return null;
}

async function fetchPageVerses(pageNumber: number) {
  const normalizedPage = clampInt(pageNumber, 1, 604, 1);
  const downloadedPageVerses = await getDownloadedPageVerses(normalizedPage);
  if (downloadedPageVerses?.length) {
    return downloadedPageVerses;
  }

  return null;
}

export async function getAppStatusPayload(currentRub: number): Promise<AppStatusPayload> {
  const hasLocalMushafData = await hasDownloadedMushafData();

  return {
    offline: hasLocalMushafData,
    rubs: 240,
    pages: 604,
    chapters: 114,
    current_rub: clampInt(currentRub, 1, 240, 1),
    backendAvailable: true
  };
}

export async function getPageContentPayload(pageNumber: number): Promise<PaginatedVersesResponse> {
  const normalizedPage = clampInt(pageNumber, 1, 604, 1);
  const verses = await fetchPageVerses(normalizedPage);
  if (!verses) {
    throw new Error("page_content_unavailable");
  }

  return {
    verses: verses as QuranVerse[]
  };
}

export async function getRubPayload(rubNumber: number, count: number): Promise<RubResponse> {
  const normalizedRub = clampInt(rubNumber, 1, 240, 1);
  const normalizedCount = clampInt(count, 1, 8, 1);

  const verses: QuranVerse[] = [];
  let currentRub = normalizedRub;
  for (let index = 0; index < normalizedCount; index += 1) {
    const currentVerses = await fetchRubVerses(currentRub);
    if (!currentVerses) {
      throw new Error("rub_content_unavailable");
    }
    verses.push(...(currentVerses as QuranVerse[]));
    currentRub = currentRub >= 240 ? 1 : currentRub + 1;
  }

  const endRub = ((normalizedRub - 1 + normalizedCount - 1) % 240) + 1;
  const visibleVerseKeysByPage = buildVisibleVerseKeysByPage(verses);
  const pageNumbers = getDistinctQcfPageNumbers(verses);

  const pageSources = await mapWithConcurrency(pageNumbers, 4, async (pageNumber) => {
    const pageVerses = await fetchPageVerses(pageNumber);
    if (!pageVerses) {
      throw new Error("rub_page_sources_unavailable");
    }

    return {
      page_number: pageNumber,
      visible_verse_keys: [...(visibleVerseKeysByPage.get(pageNumber) ?? new Set<string>())],
      verses: pageVerses as QuranVerse[]
    };
  });

  return {
    rub_number: normalizedCount > 1 ? `${normalizedRub} - ${endRub}` : normalizedRub,
    verses,
    page_sources: pageSources
  };
}

export async function getVerseSequencePayload(): Promise<VerseSequencePayload> {
  if (verseSequenceCache) return verseSequenceCache;

  const downloadedMushaf = await getDownloadedMushafData();
  const pages = downloadedMushaf?.pages;
  if (!pages) {
    throw new Error("verse_sequence_unavailable");
  }

  const verseKeys: string[] = [];
  const seenVerseKeys = new Set<string>();

  for (const rawVerseKey of downloadedMushaf?.verse_sequence ?? []) {
    const canonicalVerseKey = toCanonicalVerseKey(rawVerseKey);
    if (!canonicalVerseKey || seenVerseKeys.has(canonicalVerseKey)) continue;
    seenVerseKeys.add(canonicalVerseKey);
    verseKeys.push(canonicalVerseKey);
  }

  if (!verseKeys.length) {
    const pageNumbers = Object.keys(pages)
      .map((rawPageNumber) => clampInt(rawPageNumber, 1, 604, 0))
      .filter((pageNumber) => pageNumber > 0)
      .sort((left, right) => left - right);

    for (const pageNumber of pageNumbers) {
      const pageVerses = pages[String(pageNumber)] || [];
      for (const verse of pageVerses) {
        const canonicalVerseKey = toCanonicalVerseKey(String(verse?.verse_key || ""));
        if (!canonicalVerseKey || seenVerseKeys.has(canonicalVerseKey)) continue;
        seenVerseKeys.add(canonicalVerseKey);
        verseKeys.push(canonicalVerseKey);
      }
    }
  }

  if (!verseKeys.length) {
    throw new Error("verse_sequence_unavailable");
  }

  verseSequenceCache = {
    verses: verseKeys
  };
  return verseSequenceCache;
}

export async function getChapterIndexPayload(): Promise<ChapterIndexPayload> {
  if (chapterIndexCache) return chapterIndexCache;
  if (chapterIndexInFlight) return chapterIndexInFlight;

  chapterIndexInFlight = (async () => {
    const downloadedMushaf = await getDownloadedMushafData();
    const pages = downloadedMushaf?.pages;
    if (!pages) {
      throw new Error("chapter_index_unavailable");
    }

    const chapterAccumulator = new Map<number, { pageNumbers: Set<number>; rubNumbers: Set<number> }>();

    const pageNumbers = Object.keys(pages)
      .map((rawPageNumber) => clampInt(rawPageNumber, 1, 604, 0))
      .filter((pageNumber) => pageNumber > 0)
      .sort((left, right) => left - right);

    for (const pageNumber of pageNumbers) {
      const pageVerses = pages[String(pageNumber)] || [];

      for (const verse of pageVerses) {
        const chapterId = clampInt(verse.chapter_id, 1, 114, parseChapterNumber(String(verse?.verse_key || "")));
        if (!chapterId) continue;

        const chapterEntry =
          chapterAccumulator.get(chapterId) ||
          {
            pageNumbers: new Set<number>(),
            rubNumbers: new Set<number>()
          };

        chapterEntry.pageNumbers.add(clampInt(verse.page_number, 1, 604, pageNumber));

        const rubNumber = clampInt(verse.rub_el_hizb_number, 1, 240, 0);
        if (rubNumber) {
          chapterEntry.rubNumbers.add(rubNumber);
        }

        chapterAccumulator.set(chapterId, chapterEntry);
      }
    }

    if (!chapterAccumulator.size) {
      throw new Error("chapter_index_unavailable");
    }

    const chapterEntries = [...chapterAccumulator.entries()]
      .sort((left, right) => left[0] - right[0])
      .map(([chapterId, entry]) => {
        return [
          String(chapterId),
          {
            rub_numbers: toSortedUniqueNumbers([...entry.rubNumbers]),
            page_numbers: toSortedUniqueNumbers([...entry.pageNumbers])
          }
        ] as const;
      }
      );

    const payload: ChapterIndexPayload = {
      chapters: Object.fromEntries(chapterEntries)
    };

    chapterIndexCache = payload;
    return payload;
  })().finally(() => {
    chapterIndexInFlight = null;
  });

  return chapterIndexInFlight;
}

export async function getRecitationsPayload(): Promise<RecitationsPayload> {
  if (!recitationsCache?.length) {
    if (!recitationsFetchInFlight) {
      recitationsFetchInFlight = (async () => {
        const endpoint = "resources/recitations?language=ar";
        const payload =
          (await fetchApiJson<{ recitations?: RecitationResource[] }>(apiV4(endpoint))) ||
          (await fetchPublicApiJson<{ recitations?: RecitationResource[] }>(publicApiV4(endpoint)));
        const fetchedRecitations = (payload?.recitations || []).filter(Boolean);

        // Keep cache nullable when fetch fails so future requests can retry instead of freezing on an empty list.
        if (fetchedRecitations.length) {
          recitationsCache = fetchedRecitations;
        }
      })().finally(() => {
        recitationsFetchInFlight = null;
      });
    }

    await recitationsFetchInFlight;
  }

  const recitations = (recitationsCache || [])
    .map((recitation) => {
      const id = ensureTafsirId(recitation.id);
      if (!id) return null;
      const style = String(recitation.style || "").trim();
      const displayName =
        String(recitation.translated_name?.name || "").trim() ||
        String(recitation.reciter_name || "").trim() ||
        `القارئ ${id}`;
      return {
        id,
        name: displayName,
        style,
        label: `${displayName}${style ? ` - ${style}` : ""}`
      };
    })
    .filter(Boolean) as RecitationsPayload["recitations"];

  if (!recitations.length) {
    return {
      default_recitation_id: getDefaultRecitationId(),
      recitations: RECITATIONS_FALLBACK_LIST
    };
  }

  return {
    default_recitation_id: getDefaultRecitationId(),
    recitations
  };
}

export async function getVerseAudioPayload(verseKey: string, recitationId?: number): Promise<VerseAudioResponse> {
  const canonicalVerseKey = toCanonicalVerseKey(verseKey);
  if (!canonicalVerseKey) {
    throw new Error("bad_verse_key");
  }

  const resolvedRecitationId = clampInt(recitationId, 1, 1000, getDefaultRecitationId());
  const endpoint = `verses/by_key/${canonicalVerseKey}?fields=text_uthmani&audio=${resolvedRecitationId}`;
  const payload = (await fetchApiJson<{
    verse?: {
      verse_key?: string;
      text_uthmani?: string;
      audio?: {
        url?: string;
      };
    };
  }>(apiV4(endpoint))) ||
    (await fetchPublicApiJson<{
      verse?: {
        verse_key?: string;
        text_uthmani?: string;
        audio?: {
          url?: string;
        };
      };
    }>(publicApiV4(endpoint)));

  const verse = payload?.verse;
  const audioUrl = normalizeAudioUrl(verse?.audio?.url);
  if (!verse || !audioUrl) {
    throw new Error("verse_audio_not_found");
  }

  return {
    verse_key: String(verse.verse_key || canonicalVerseKey),
    verse_text: String(verse.text_uthmani || ""),
    recitation_id: resolvedRecitationId,
    audio_url: audioUrl
  };
}

export async function getRubRecitationPayload(
  rubNumber: number,
  count: number,
  recitationId?: number
): Promise<RubRecitationPayload> {
  const normalizedRub = clampInt(rubNumber, 1, 240, 1);
  const normalizedCount = clampInt(count, 1, 8, 1);
  const resolvedRecitationId = clampInt(recitationId, 1, 1000, getDefaultRecitationId());

  const audioFiles: RubRecitationPayload["audio_files"] = [];
  let currentRub = normalizedRub;

  for (let index = 0; index < normalizedCount; index += 1) {
    const current = await fetchRubRecitationAudioFiles(resolvedRecitationId, currentRub);
    if (!current) {
      throw new Error("rub_recitation_unavailable");
    }
    audioFiles.push(...current);
    currentRub = currentRub >= 240 ? 1 : currentRub + 1;
  }

  if (!audioFiles.length) {
    throw new Error("rub_recitation_not_found");
  }

  return {
    rub_number: normalizedRub,
    count: normalizedCount,
    recitation_id: resolvedRecitationId,
    audio_files: audioFiles
  };
}

export async function getPageRecitationPayload(pageNumber: number, recitationId?: number): Promise<PageRecitationPayload> {
  const normalizedPage = clampInt(pageNumber, 1, 604, 1);
  const resolvedRecitationId = clampInt(recitationId, 1, 1000, getDefaultRecitationId());

  const audioFiles = await fetchPageRecitationAudioFiles(resolvedRecitationId, normalizedPage);
  if (!audioFiles) {
    throw new Error("page_recitation_unavailable");
  }
  if (!audioFiles.length) {
    throw new Error("page_recitation_not_found");
  }

  return {
    page_number: normalizedPage,
    recitation_id: resolvedRecitationId,
    audio_files: audioFiles
  };
}

export async function getRubWordTimingsPayload(
  rubNumber: number,
  count: number,
  recitationId?: number
): Promise<RubWordTimingsPayload> {
  const normalizedRub = clampInt(rubNumber, 1, 240, 1);
  const normalizedCount = clampInt(count, 1, 8, 1);
  const resolvedRecitationId = clampInt(recitationId, 1, 1000, getDefaultRecitationId());

  const verseKeys = new Set<string>();
  const chapterNumbers = new Set<number>();
  let currentRub = normalizedRub;

  for (let index = 0; index < normalizedCount; index += 1) {
    const verses = await fetchRubVerses(currentRub);
    if (!verses) {
      throw new Error("rub_word_timings_unavailable");
    }

    for (const verse of verses as Array<{ verse_key?: string; chapter_id?: number }>) {
      const verseKey = String(verse?.verse_key || "").trim();
      if (!verseKey) continue;
      verseKeys.add(verseKey);

      const chapterId = clampInt(verse?.chapter_id, 0, 114, 0) || parseChapterNumber(verseKey);
      if (chapterId > 0) {
        chapterNumbers.add(chapterId);
      }
    }

    currentRub = currentRub >= 240 ? 1 : currentRub + 1;
  }

  const wordTimings: RubWordTimingsPayload["word_timings"] = {};
  for (const chapterNumber of [...chapterNumbers].sort((a, b) => a - b)) {
    const chapterTimings = await fetchChapterRecitationSegments(resolvedRecitationId, chapterNumber);
    if (!chapterTimings) continue;

    for (const [verseKey, timingData] of Object.entries(chapterTimings)) {
      if (verseKeys.has(verseKey)) {
        wordTimings[verseKey] = timingData;
      }
    }
  }

  return {
    rub_number: normalizedRub,
    count: normalizedCount,
    recitation_id: resolvedRecitationId,
    word_timings: wordTimings
  };
}

export async function getPageWordTimingsPayload(pageNumber: number, recitationId?: number): Promise<PageWordTimingsPayload> {
  const normalizedPage = clampInt(pageNumber, 1, 604, 1);
  const resolvedRecitationId = clampInt(recitationId, 1, 1000, getDefaultRecitationId());

  const verses = await fetchPageVerses(normalizedPage);
  if (!verses) {
    throw new Error("page_word_timings_unavailable");
  }

  const verseKeys = new Set<string>();
  const chapterNumbers = new Set<number>();

  for (const verse of verses as Array<{ verse_key?: string; chapter_id?: number }>) {
    const verseKey = String(verse?.verse_key || "").trim();
    if (!verseKey) continue;
    verseKeys.add(verseKey);

    const chapterId = clampInt(verse?.chapter_id, 0, 114, 0) || parseChapterNumber(verseKey);
    if (chapterId > 0) {
      chapterNumbers.add(chapterId);
    }
  }

  if (!verseKeys.size) {
    throw new Error("page_word_timings_not_found");
  }

  const wordTimings: PageWordTimingsPayload["word_timings"] = {};
  for (const chapterNumber of [...chapterNumbers].sort((a, b) => a - b)) {
    const chapterTimings = await fetchChapterRecitationSegments(resolvedRecitationId, chapterNumber);
    if (!chapterTimings) continue;

    for (const [verseKey, timingData] of Object.entries(chapterTimings)) {
      if (verseKeys.has(verseKey)) {
        wordTimings[verseKey] = timingData;
      }
    }
  }

  return {
    page_number: normalizedPage,
    recitation_id: resolvedRecitationId,
    word_timings: wordTimings
  };
}

export async function getTafsirPayload(verseKey: string, tafsirId?: number): Promise<TafsirPayload> {
  const canonicalVerseKey = toCanonicalVerseKey(verseKey);
  if (!canonicalVerseKey) {
    throw new Error("bad_verse_key");
  }

  const resolvedTafsirId = clampInt(tafsirId, 1, 10_000, await resolveDefaultTafsirId() || 16);
  const endpoint = `verses/by_key/${canonicalVerseKey}?fields=text_uthmani&words=false&tafsirs=${resolvedTafsirId}`;
  type TafsirLookupPayload = {
    verse?: {
      verse_key?: string;
      text_uthmani?: string;
      tafsirs?: Array<{
        resource_id?: number;
        name?: string;
        language_name?: string;
        text?: string;
      }>;
    };
  };

  type TafsirByAyahPayload = {
    tafsir?: {
      resource_id?: number;
      resource_name?: string;
      language_name?: string;
      translated_name?: {
        language_name?: string;
      };
      text?: string;
    };
  };

  const apiPayload = await fetchApiJson<TafsirLookupPayload>(apiV4(endpoint));
  const payload =
    (apiPayload?.verse?.tafsirs?.length
      ? apiPayload
      : (await fetchPublicApiJson<TafsirLookupPayload>(publicApiV4(endpoint))) || apiPayload);

  let verse = payload?.verse;
  let tafsir = verse?.tafsirs?.[0];

  if (!tafsir) {
    for (const candidateId of getTafsirFallbackCandidateIds(resolvedTafsirId)) {
      const byAyahEndpoint = `tafsirs/${candidateId}/by_ayah/${canonicalVerseKey}`;
      const byAyahPayload =
        (await fetchApiJson<TafsirByAyahPayload>(apiV4(byAyahEndpoint))) ||
        (await fetchPublicApiJson<TafsirByAyahPayload>(publicApiV4(byAyahEndpoint)));
      const byAyahTafsir = byAyahPayload?.tafsir;
      if (!byAyahTafsir) continue;

      tafsir = {
        resource_id: clampInt(byAyahTafsir.resource_id, 1, 10_000, candidateId),
        name: String(byAyahTafsir.resource_name || "التفسير"),
        language_name: String(byAyahTafsir.language_name || byAyahTafsir.translated_name?.language_name || ""),
        text: String(byAyahTafsir.text || "")
      };
      break;
    }
  }

  if (!verse) {
    const verseEndpoint = `verses/by_key/${canonicalVerseKey}?fields=text_uthmani&words=false`;
    const versePayload = (await fetchApiJson<TafsirLookupPayload>(apiV4(verseEndpoint))) ||
      (await fetchPublicApiJson<TafsirLookupPayload>(publicApiV4(verseEndpoint)));
    verse = versePayload?.verse;
  }

  if (!verse || !tafsir) {
    throw new Error("tafsir_not_found");
  }

  const text = String(tafsir.text || "");
  return {
    verse_key: String(verse.verse_key || canonicalVerseKey),
    verse_text: String(verse.text_uthmani || ""),
    tafsir: {
      resource_id: clampInt(tafsir.resource_id, 1, 10_000, resolvedTafsirId),
      name: String(tafsir.name || "التفسير"),
      language_name: String(tafsir.language_name || ""),
      text,
      plain_text: extractTafsirPlainText(text)
    }
  };
}

export async function getSurahChallengePayload(chapter: number, page: number, perPage: number): Promise<PaginatedVersesResponse> {
  const normalizedChapter = clampInt(chapter, 1, 114, 18);
  const normalizedPage = clampInt(page, 1, 9_999, 1);
  const normalizedPerPage = clampInt(perPage, 1, 200, 15);

  const endpoint = `verses/by_chapter/${normalizedChapter}?fields=text_uthmani&words=true&word_fields=${encodeURIComponent(PAGE_LAYOUT_WORD_FIELDS)}&per_page=${normalizedPerPage}&page=${normalizedPage}`;
  const payload = (await fetchApiJson<PaginatedVersesResponse>(apiV4(endpoint))) ||
    (await fetchPublicApiJson<PaginatedVersesResponse>(publicApiV4(endpoint)));

  if (payload?.verses?.length || payload?.pagination) {
    return payload;
  }

  throw new Error("surah_challenge_unavailable");
}
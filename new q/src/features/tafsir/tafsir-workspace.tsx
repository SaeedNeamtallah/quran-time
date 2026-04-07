"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, ArrowDown, Plus, Minus } from "lucide-react";
import { useShallow } from "zustand/react/shallow";

import { TAFSIR_FONT_SIZES, TAFSIR_OPTIONS } from "@/lib/constants/app";
import { fetchTafsir, loadVerseSequence } from "@/lib/api/client";
import { getAppStatusQueryOptions } from "@/lib/api/app-status-query";
import { cn } from "@/lib/utils/cn";
import { decodeVerseKeyParam, getTafsirPath } from "@/lib/utils/verse";
import { formatVerseMarker, highlightTafsirText } from "@/lib/utils/format";
import { buildTafsirBlocks } from "@/lib/utils/tafsir";
import { useReaderStore } from "@/lib/stores/reader-store";
import { useSettingsStore } from "@/lib/stores/settings-store";

function stepTafsirFontSize(currentValue: string, direction: 1 | -1) {
  const index = Math.max(0, TAFSIR_FONT_SIZES.indexOf(currentValue as (typeof TAFSIR_FONT_SIZES)[number]));
  const nextIndex = Math.min(TAFSIR_FONT_SIZES.length - 1, Math.max(0, index + direction));
  return TAFSIR_FONT_SIZES[nextIndex];
}

export function TafsirWorkspace({ verseKey: rawVerseKey }: { verseKey: string }) {
  const router = useRouter();
  const verseKey = decodeVerseKeyParam(rawVerseKey);

  const settings = useSettingsStore(useShallow((state) => ({
    rubPageSpreadCount: state.rubPageSpreadCount,
    mushafPageDisplayCount: state.mushafPageDisplayCount,
    mushafZoomMode: state.mushafZoomMode,
    mushafLineWidthMode: state.mushafLineWidthMode,
    tafsirId: state.tafsirId,
    tafsirHighlightColor: state.tafsirHighlightColor,
    tafsirFontSize: state.tafsirFontSize
  })));
  const patchSettings = useSettingsStore((state) => state.patchSettings);
  const lastReaderRoute = useReaderStore((state) => state.lastReaderRoute);

  const [enhanceError, setEnhanceError] = useState("");

  const statusQuery = useQuery(getAppStatusQueryOptions());

  const tafsirQuery = useQuery({
    queryKey: ["tafsir", verseKey, settings.tafsirId],
    queryFn: () =>
      fetchTafsir(verseKey, {
        studyDuration: 30,
        breakDuration: 15,
        dailyGoalHours: 1,
        rubCount: 1,
        theme: "mint",
        readingMode: "rub",
        recitationId: 7,
        verseAudioOnClick: true,
        challengeSurah: 18,
        quranFontSize: "2.3rem",
        ...settings
      })
  });

  const sequenceQuery = useQuery({
    queryKey: ["verse-sequence"],
    queryFn: loadVerseSequence
  });

  const currentIndex = useMemo(() => sequenceQuery.data?.indexOf(verseKey) ?? -1, [sequenceQuery.data, verseKey]);
  const previousVerseKey = currentIndex > 0 ? sequenceQuery.data?.[currentIndex - 1] : "";
  const nextVerseKey = currentIndex >= 0 && currentIndex < (sequenceQuery.data?.length ?? 0) - 1 ? sequenceQuery.data?.[currentIndex + 1] : "";

  useEffect(() => {
    setEnhanceError("");
  }, [settings.tafsirId, verseKey]);

  const tafsirBlocks = useMemo(() => {
    return buildTafsirBlocks(tafsirQuery.data?.tafsir.text ?? "", tafsirQuery.data?.tafsir.plain_text ?? "");
  }, [tafsirQuery.data?.tafsir.plain_text, tafsirQuery.data?.tafsir.text]);


  function renderBlock(text: string, index: number, kind: "heading" | "paragraph") {
    const Tag = kind === "heading" ? "h3" : "p";
    return (
      <Tag
        key={`${kind}-${index}-${text.slice(0, 12)}`}
        data-testid={`tafsir-block-${kind}-${index}`}
        className={cn(
          "text-ink",
          kind === "heading" ? "text-lg font-semibold leading-[2.1] sm:text-xl" : "leading-[2.2]"
        )}
      >
        {highlightTafsirText(text).map((part) => (
          <span
            key={part.id}
            className={cn(
              part.type === "red" && "font-extrabold text-red-800",
              part.type === "green" && "font-bold text-emerald-700",
              part.type === "purple" && "font-bold text-violet-700",
              part.type === "blue" && "font-extrabold text-blue-700",
              part.type === "gold" && "font-extrabold text-amber-600"
            )}
          >
            {part.text}
          </span>
        ))}
      </Tag>
    );
  }

  return (
    <div className="grid gap-4">
      <section className="col-span-1">
        <article className="glass-panel rounded-[2rem] px-4 py-4 sm:px-6">
          <div className="mb-4 space-y-4">
            {/* Verse Text taking full width */}
            <div className="pt-2">
              <h1 className="quran-text text-[clamp(1.35rem,2vw,2.1rem)] text-ink leading-relaxed">
                {(tafsirQuery.data?.verse_text ?? "جاري تحميل نص الآية...").trim()}
                <span className="mx-2 inline-flex h-9 min-w-9 items-center justify-center rounded-full border border-accent/20 bg-accent/10 px-1.5 font-sans text-base font-bold text-accent align-middle">
                  {formatVerseMarker(tafsirQuery.data?.verse_key ?? verseKey)}
                </span>
              </h1>
              <div className="mt-2">
                <span
                  data-testid="tafsir-source-badge"
                  className="inline-flex items-center rounded-full border border-line/70 bg-surface/70 px-3 py-1 text-[11px] font-semibold text-muted"
                >
                  {tafsirQuery.data?.tafsir.name ?? "--"}
                </span>
              </div>
            </div>

            {/* Bottom Bar: Tools */}
            <div className="flex flex-wrap items-center justify-end gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <select
                    value={settings.tafsirId}
                    onChange={(e) => patchSettings({ tafsirId: Number(e.target.value) })}
                    aria-label="اختر التفسير"
                    title="اختر التفسير"
                    className="appearance-none rounded-full border border-line bg-surface/80 py-1.5 pl-8 pr-3 text-xs font-semibold text-muted outline-none ring-0 transition hover:border-accent/30 hover:text-accent focus:border-accent sm:text-sm"
                  >
                    {TAFSIR_OPTIONS.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <ArrowDown className="h-3.5 w-3.5 text-muted" />
                  </div>
                </div>

                <Link
                  href={lastReaderRoute || "/reader/rub"}
                  className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface/80 px-3 py-1.5 text-xs font-semibold text-ink transition hover:border-accent/30 hover:text-accent sm:text-sm"
                >
                  <ArrowRight className="h-3.5 w-3.5" />
                  العودة للقراءة
                </Link>
              </div>
            </div>
          </div>

          <hr className="my-4 border-line/60" />

          {tafsirQuery.isLoading ? (
            <div className="text-sm leading-8 text-muted">جاري تحميل التفسير...</div>
          ) : tafsirQuery.error ? (
            <div className="space-y-3">
              <p className="text-sm leading-8 text-muted">
                {tafsirQuery.error instanceof Error ? tafsirQuery.error.message : "تعذر تحميل التفسير."}
              </p>
              {!statusQuery.data?.backendAvailable ? (
                <p className="text-sm leading-8 text-muted">التفسير يحتاج السيرفر المحلي الحالي، وهو غير متاح الآن.</p>
              ) : null}
            </div>
          ) : (
            <div data-testid="tafsir-content" className="tafsir-content space-y-4">
              {enhanceError ? <p className="text-sm leading-8 text-rose-700">{enhanceError}</p> : null}
              {tafsirBlocks.map((block, index) => renderBlock(block.text, index, block.type))}
            </div>
          )}
        </article>
      </section>

      {/* Floating Controls */}
      <div className="fixed bottom-6 left-3 z-40 flex flex-col gap-1 md:bottom-5 md:left-5">
        <div className="flex w-10 flex-col items-center gap-1 pt-5">
          <button
            type="button"
            data-testid="tafsir-prev-button"
            disabled={!previousVerseKey}
            onClick={() => previousVerseKey && router.replace(getTafsirPath(previousVerseKey))}
            aria-label="الآية السابقة"
            className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-line bg-surface/88 text-ink shadow-halo backdrop-blur-xl transition hover:border-accent/30 hover:text-accent disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
          
          <button
            type="button"
            data-testid="tafsir-next-button"
            disabled={!nextVerseKey}
            onClick={() => nextVerseKey && router.replace(getTafsirPath(nextVerseKey))}
            aria-label="الآية التالية"
            className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-line bg-surface/88 text-ink shadow-halo backdrop-blur-xl transition hover:border-accent/30 hover:text-accent disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="fixed bottom-6 right-4 z-40 flex flex-col gap-1 md:bottom-5 md:right-6">
        <div className="flex w-10 flex-col items-center gap-1 pt-5">
          <button
            type="button"
            onClick={() => patchSettings({ tafsirFontSize: stepTafsirFontSize(settings.tafsirFontSize, 1) })}
            aria-label="تكبير الخط"
            className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-line bg-surface/88 text-ink shadow-halo backdrop-blur-xl transition hover:border-accent/30 hover:text-accent"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            onClick={() => patchSettings({ tafsirFontSize: stepTafsirFontSize(settings.tafsirFontSize, -1) })}
            aria-label="تصغير الخط"
            className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-line bg-surface/88 text-ink shadow-halo backdrop-blur-xl transition hover:border-accent/30 hover:text-accent"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <style jsx>{`
        .tafsir-content {
          font-size: ${settings.tafsirFontSize};
        }
      `}</style>
    </div>
  );
}

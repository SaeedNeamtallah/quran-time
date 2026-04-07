"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { BookOpen, ChevronDown, Clock, Target, Gauge } from "lucide-react";

import { FOCUS_QUOTES } from "@/lib/constants/app";
import { cn } from "@/lib/utils/cn";
import { primeGlobalAlarm } from "@/lib/utils/alarm-bridge";
import { formatTime } from "@/lib/utils/format";
import { useSettingsStore } from "@/lib/stores/settings-store";
import { useTimerStore } from "@/lib/stores/timer-store";
import { useReaderStore } from "@/lib/stores/reader-store";

const FIRST_RUN_GUIDE_STORAGE_KEY = "quranic-pomodoro-next-first-run-tour-v2";

const FIRST_RUN_TOUR_STEPS = [
  {
    id: "focus-timer",
    targetSelector: '[data-testid="focus-timer-trigger"]',
    title: "تشغيل الجلسة",
    description: "ابدأ أو أوقف المؤقت من هذا الزر الدائري. هنا تبدأ كل دورة تركيز وقراءة."
  },
  {
    id: "focus-study",
    targetSelector: '[data-testid="focus-study-pill"]',
    title: "وقت المذاكرة",
    description: "غيّر مدة المذاكرة مباشرة من هذا العنصر قبل البدء."
  },
  {
    id: "focus-break",
    targetSelector: '[data-testid="focus-break-pill"]',
    title: "وقت القراءة",
    description: "من هنا تضبط مدة القراءة القرآنية (الاستراحة) بدقة."
  },
  {
    id: "nav-reader",
    targetSelector: '[data-tour-id="nav-reader"]',
    title: "التلاوة والتفسير",
    description: "ادخل إلى القراءة من هذا الزر، ثم استخدم زر الصوت للتلاوة وزر التفسير أو رقم الآية لفتح التفسير."
  },
  {
    id: "nav-settings",
    targetSelector: '[data-tour-id="nav-settings"]',
    title: "الضبط المتقدم",
    description: "من الإعدادات تثبّت القارئ، نوع التفسير، الخطوط، وباقي خيارات التجربة."
  }
] as const;

/* ------------------------------------------------------------------ */
/*  Tiny inline dropdown used for each setting pill                    */
/* ------------------------------------------------------------------ */

interface DropdownOption<TValue extends string | number = number> {
  value: TValue;
  label: string;
}

function SettingPill<TValue extends string | number>({
  icon: Icon,
  label,
  displayValue,
  options,
  selectedValue,
  onSelect,
  testId
}: {
  icon: typeof Target;
  label: string;
  displayValue: string;
  options: DropdownOption<TValue>[];
  selectedValue: TValue;
  onSelect: (value: TValue) => void;
  testId?: string;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  /* close on outside click */
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={containerRef} className="relative" data-testid={testId}>
      <button
        type="button"
        dir="rtl"
        onClick={() => setOpen(!open)}
        className={cn(
          "flex flex-row-reverse items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[11px] font-semibold backdrop-blur-xl transition",
          open
            ? "border-accent/30 bg-accent/8 text-accent"
            : "border-white/15 bg-white/5 text-ink/70 hover:border-white/25 hover:bg-white/8 hover:text-ink"
        )}
      >
        <ChevronDown className={cn("h-3 w-3 opacity-50 transition-transform", open && "rotate-180")} />
        <span className="max-w-[7rem] truncate">{displayValue}</span>
        <Icon className="h-3 w-3 opacity-60" />
      </button>

      {open ? (
        <div dir="rtl" className="absolute right-0 top-full z-50 mt-1.5 min-w-[13rem] max-h-60 overflow-y-auto rounded-xl border border-line/70 bg-surface py-1.5 shadow-halo backdrop-blur-2xl">
          <p className="px-3 pb-1.5 pt-1 text-[10px] font-bold tracking-wider text-muted">
            {label}
          </p>
          {options.map((option) => {
            const isActive = option.value === selectedValue;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onSelect(option.value);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-2 text-right text-sm transition",
                  isActive ? "bg-accent/12 font-bold text-accent" : "text-ink hover:bg-mist"
                )}
              >
                <span className="flex-1">{option.label}</span>
                {isActive ? <span className="text-xs text-accent">✓</span> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main workspace                                                     */
/* ------------------------------------------------------------------ */

export function FocusWorkspace() {
  const studyDuration = useSettingsStore((state) => state.studyDuration);
  const breakDuration = useSettingsStore((state) => state.breakDuration);
  const dailyGoalHours = useSettingsStore((state) => state.dailyGoalHours);
  const readingMode = useSettingsStore((state) => state.readingMode);
  const rubCount = useSettingsStore((state) => state.rubCount);
  const mushafPageDisplayCount = useSettingsStore((state) => state.mushafPageDisplayCount);
  const patchSettings = useSettingsStore((state) => state.patchSettings);

  const phase = useTimerStore((state) => state.phase);
  const isRunning = useTimerStore((state) => state.isRunning);
  const remainingSeconds = useTimerStore((state) => state.remainingSeconds);
  const start = useTimerStore((state) => state.start);
  const pause = useTimerStore((state) => state.pause);
  const hydrateDurations = useTimerStore((state) => state.hydrateDurations);

  const [quoteIndex, setQuoteIndex] = useState(0);
  const [hasTouchedCurrentPhase, setHasTouchedCurrentPhase] = useState(false);
  const [fitScale, setFitScale] = useState(1);
  const [scaledFrameSize, setScaledFrameSize] = useState({ width: 0, height: 0 });
  const [hasMounted, setHasMounted] = useState(false);
  const [showFirstRunTour, setShowFirstRunTour] = useState(false);
  const [tourStepIndex, setTourStepIndex] = useState(0);
  const [tourTargetRect, setTourTargetRect] = useState<DOMRect | null>(null);

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const lastReaderRoute = useReaderStore((state) => state.lastReaderRoute) || "/reader/rub";

  /* ---- derived data ---- */

  const durations = useMemo(
    () => ({
      studySeconds: studyDuration * 60,
      breakSeconds: breakDuration * 60
    }),
    [breakDuration, studyDuration]
  );

  const goalOptions = useMemo<DropdownOption[]>(
    () => Array.from({ length: 16 }, (_, i) => ({ value: i + 1, label: `${i + 1} ساعة` })),
    []
  );

  const studyOptions = useMemo<DropdownOption[]>(
    () => [5, 10, 15, 20, 25, 30, 45, 60, 90, 120].map((m) => ({ value: m, label: `${m} دقيقة` })),
    []
  );

  const breakOptions = useMemo<DropdownOption[]>(
    () => [5, 10, 15, 20, 30, 45, 60].map((m) => ({ value: m, label: `${m} دقيقة` })),
    []
  );

  const challengeModeOptions = useMemo<DropdownOption<string>[]>(() => {
    const pageOptions: DropdownOption<string>[] = [
      { value: "page:1", label: "صفحة واحدة" },
      { value: "page:2", label: "صفحتان" },
      { value: "page:3", label: "3 صفحات" }
    ];

    const rubOptions: DropdownOption<string>[] = Array.from({ length: 8 }, (_, index) => {
      const count = index + 1;
      if (count === 1) return { value: `rub:${count}`, label: "ربع واحد" };
      if (count === 2) return { value: `rub:${count}`, label: "ربعان" };
      return { value: `rub:${count}`, label: `${count} أرباع` };
    });

    return [...pageOptions, ...rubOptions];
  }, []);

  const challengeModeDisplayValue = useMemo(() => {
    if (readingMode === "page") {
      if (mushafPageDisplayCount === 2) return "صفحتان";
      if (mushafPageDisplayCount === 3) return "3 صفحات";
      return "صفحة";
    }

    if (rubCount === 2) return "ربعان";
    if (rubCount >= 3) return `${rubCount} أرباع`;
    return "ربع";
  }, [mushafPageDisplayCount, readingMode, rubCount]);

  const selectedChallengeOption = readingMode === "page" ? `page:${mushafPageDisplayCount}` : `rub:${rubCount}`;




  /* ---- effects ---- */

  /* Sync timer with new durations when changed (only while paused) */
  useEffect(() => {
    hydrateDurations(durations);
  }, [durations, hydrateDurations]);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setQuoteIndex((current) => (current + 1) % FOCUS_QUOTES.length);
    }, 120000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const hasSeenGuide = window.localStorage.getItem(FIRST_RUN_GUIDE_STORAGE_KEY) === "seen";
      if (!hasSeenGuide) {
        setShowFirstRunTour(true);
      }
    } catch {
      setShowFirstRunTour(true);
    }
  }, []);

  useEffect(() => {
    if (!showFirstRunTour) {
      setTourTargetRect(null);
      return;
    }

    const step = FIRST_RUN_TOUR_STEPS[tourStepIndex];
    const target = document.querySelector(step.targetSelector) as HTMLElement | null;
    if (!target) {
      setTourTargetRect(null);
      return;
    }

    target.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" });

    const updateRect = () => {
      setTourTargetRect(target.getBoundingClientRect());
    };

    updateRect();

    const resizeObserver = new ResizeObserver(updateRect);
    resizeObserver.observe(target);

    window.addEventListener("resize", updateRect);
    window.addEventListener("scroll", updateRect, true);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateRect);
      window.removeEventListener("scroll", updateRect, true);
    };
  }, [showFirstRunTour, tourStepIndex]);

  useEffect(() => { setHasTouchedCurrentPhase(false); }, [phase]);
  useEffect(() => { if (isRunning) setHasTouchedCurrentPhase(true); }, [isRunning]);

  useEffect(() => {
    const updateFitScale = () => {
      const viewport = viewportRef.current;
      const content = contentRef.current;
      if (!viewport || !content) return;

      const availableWidth = Math.max(0, viewport.clientWidth - 12);
      const availableHeight = Math.max(0, viewport.clientHeight - 12);
      const contentWidth = content.offsetWidth;
      const contentHeight = content.offsetHeight;

      if (!availableWidth || !availableHeight || !contentWidth || !contentHeight) {
        setFitScale(1);
        setScaledFrameSize({ width: 0, height: 0 });
        return;
      }

      const nextScale = Math.min(1, availableWidth / contentWidth, availableHeight / contentHeight);
      const safeScale = Number.isFinite(nextScale) && nextScale > 0 ? Number(nextScale.toFixed(3)) : 1;

      setFitScale(safeScale);
      setScaledFrameSize({
        width: Math.ceil(contentWidth * safeScale),
        height: Math.ceil(contentHeight * safeScale)
      });
    };

    updateFitScale();

    const resizeObserver = new ResizeObserver(updateFitScale);
    if (viewportRef.current) resizeObserver.observe(viewportRef.current);
    if (contentRef.current) resizeObserver.observe(contentRef.current);

    window.addEventListener("resize", updateFitScale);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateFitScale);
    };
  }, []);

  /* ---- computed ---- */

  const currentQuote = FOCUS_QUOTES[quoteIndex];
  const totalSeconds = phase === "study" ? durations.studySeconds : durations.breakSeconds;
  const progress = Math.max(0, Math.min(100, (remainingSeconds / Math.max(1, totalSeconds)) * 100));
  const isStudyPhase = phase === "study";
  const isInitialStudyState = isStudyPhase && !isRunning && remainingSeconds === durations.studySeconds && !hasTouchedCurrentPhase;
  const canToggleTimer = remainingSeconds > 0;
  const timerLabel = phase === "study" ? "وقت التركيز" : "وقت القرآن";
  const timerHint = isRunning
    ? "اضغط على الدائرة لإيقاف المؤقت"
    : isInitialStudyState
      ? "اضغط على الدائرة لبدء الجلسة"
      : "اضغط على الدائرة لتشغيل المؤقت";
  const timerAccent = !isRunning ? "rgb(var(--ink))" : isStudyPhase ? "#10b981" : "#06b6d4";
  const timerTrack = !isRunning ? "rgb(var(--mist))" : "rgb(var(--line) / 0.35)";
  const timerShadow = !isRunning ? "none" : isStudyPhase ? "0 30px 80px rgba(16, 185, 129, 0.18)" : "0 30px 80px rgba(6, 182, 212, 0.18)";
  const hasScaledFrameSize = scaledFrameSize.width > 0 && scaledFrameSize.height > 0;
  const scaledFrameWidth = hasScaledFrameSize ? `${scaledFrameSize.width}px` : "auto";
  const scaledFrameHeight = hasScaledFrameSize ? `${scaledFrameSize.height}px` : "auto";

  async function handleTimerPress() {
    if (!canToggleTimer) return;
    setHasTouchedCurrentPhase(true);

    if (isRunning) {
      pause();
      return;
    }

    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
    await primeGlobalAlarm();
    start();
  }

  function finishFirstRunTour() {
    setShowFirstRunTour(false);
    setTourStepIndex(0);
    setTourTargetRect(null);

    try {
      window.localStorage.setItem(FIRST_RUN_GUIDE_STORAGE_KEY, "seen");
    } catch {
      // Ignore storage failures and keep the app usable.
    }
  }

  function goToNextTourStep() {
    setTourStepIndex((current) => {
      if (current >= FIRST_RUN_TOUR_STEPS.length - 1) {
        finishFirstRunTour();
        return current;
      }
      return current + 1;
    });
  }

  function goToPreviousTourStep() {
    setTourStepIndex((current) => Math.max(0, current - 1));
  }

  const currentTourStep = FIRST_RUN_TOUR_STEPS[tourStepIndex];
  const isFirstTourStep = tourStepIndex === 0;
  const isLastTourStep = tourStepIndex === FIRST_RUN_TOUR_STEPS.length - 1;

  const tourSpotlightMetrics = useMemo(() => {
    if (!tourTargetRect) return null;

    const padding = 8;
    const top = Math.max(8, tourTargetRect.top - padding);
    const left = Math.max(8, tourTargetRect.left - padding);
    const width = Math.max(24, tourTargetRect.width + padding * 2);
    const height = Math.max(24, tourTargetRect.height + padding * 2);

    return {
      top,
      left,
      width,
      height
    };
  }, [tourTargetRect]);

  const tourPopoverMetrics = useMemo(() => {
    if (!hasMounted) {
      return {
        top: "50%",
        left: "50%",
        width: "min(380px, calc(100vw - 24px))",
        transform: "translate(-50%, -50%)"
      };
    }

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const margin = 12;
    const popoverWidth = Math.min(380, viewportWidth - margin * 2);
    const estimatedHeight = 230;

    if (!tourTargetRect) {
      return {
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        width: `${popoverWidth}px`
      };
    }

    let left = tourTargetRect.left + tourTargetRect.width / 2 - popoverWidth / 2;
    left = Math.max(margin, Math.min(left, viewportWidth - popoverWidth - margin));

    const preferredTop = tourTargetRect.bottom + 14;
    const top =
      preferredTop + estimatedHeight <= viewportHeight - margin
        ? preferredTop
        : Math.max(margin, tourTargetRect.top - estimatedHeight - 14);

    return {
      top: `${Math.round(top)}px`,
      left: `${Math.round(left)}px`,
      width: `${Math.round(popoverWidth)}px`,
      transform: "none"
    };
  }, [hasMounted, tourTargetRect]);

  const tourSpotlightTop = tourSpotlightMetrics ? `${Math.round(tourSpotlightMetrics.top)}px` : "-9999px";
  const tourSpotlightLeft = tourSpotlightMetrics ? `${Math.round(tourSpotlightMetrics.left)}px` : "-9999px";
  const tourSpotlightWidth = tourSpotlightMetrics ? `${Math.round(tourSpotlightMetrics.width)}px` : "0px";
  const tourSpotlightHeight = tourSpotlightMetrics ? `${Math.round(tourSpotlightMetrics.height)}px` : "0px";

  function handleDurationChange(type: "study" | "break", minutes: number) {
    const newDurations = {
      studySeconds: type === "study" ? minutes * 60 : durations.studySeconds,
      breakSeconds: type === "break" ? minutes * 60 : durations.breakSeconds
    };
    patchSettings(type === "study" ? { studyDuration: minutes } : { breakDuration: minutes });
    useTimerStore.getState().reset(newDurations);
    useTimerStore.getState().start();
  }

  /* ---- render ---- */

  return (
    <section className="relative flex h-full min-h-0 flex-1 items-stretch overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-[8%] top-[12%] h-44 w-44 rounded-full bg-accent/10 blur-3xl sm:h-56 sm:w-56" />
        <div className="absolute right-[10%] top-[18%] h-36 w-36 rounded-full bg-surface/45 blur-3xl sm:h-48 sm:w-48" />
        <div className="absolute bottom-[8%] left-1/2 h-56 w-56 -translate-x-1/2 rounded-full bg-accent/8 blur-3xl sm:h-72 sm:w-72" />
      </div>

      {/* Right-side setting pills — small, transparent, non-intrusive */}
      <div className="pointer-events-auto absolute right-3 top-3 z-30 flex flex-col items-end gap-1.5 sm:right-5 sm:top-4">
        <SettingPill
          icon={Target}
          label="الهدف اليومي"
          displayValue={`${dailyGoalHours} ساعة`}
          options={goalOptions}
          selectedValue={dailyGoalHours}
          onSelect={(v) => patchSettings({ dailyGoalHours: v })}
          testId="focus-goal-pill"
        />
        <SettingPill
          icon={Clock}
          label="مدة المذاكرة"
          displayValue={`مذاكرة ${studyDuration}د`}
          options={studyOptions}
          selectedValue={studyDuration}
          onSelect={(v) => handleDurationChange("study", v)}
          testId="focus-study-pill"
        />
        <SettingPill
          icon={Clock}
          label="مدة القراءة"
          displayValue={`قراءة ${breakDuration}د`}
          options={breakOptions}
          selectedValue={breakDuration}
          onSelect={(v) => handleDurationChange("break", v)}
          testId="focus-break-pill"
        />
        <SettingPill
          icon={BookOpen}
          label="وضع التحدي"
          displayValue={challengeModeDisplayValue}
          options={challengeModeOptions}
          selectedValue={selectedChallengeOption}
          onSelect={(v) => {
            if (typeof v !== "string") return;
            const [modeRaw, countRaw] = v.split(":");
            const count = Number(countRaw);
            if (!Number.isInteger(count)) return;

            const newMode = modeRaw === "page" ? "page" : "rub";

            patchSettings(
              newMode === "page"
                ? { readingMode: "page", mushafPageDisplayCount: count }
                : { readingMode: "rub", rubCount: count }
            );
            useReaderStore.getState().setLastReaderRoute(newMode === "page" ? "/reader/page" : "/reader/rub");
          }}
          testId="focus-mode-pill"
        />

        <Link
          href="/stats"
          dir="rtl"
          className="mt-1 flex flex-row-reverse items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-2.5 py-1.5 text-[11px] font-semibold text-ink/70 backdrop-blur-xl transition hover:border-white/25 hover:bg-white/8 hover:text-ink"
        >
          <span className="max-w-[7rem] truncate">الإحصاءات</span>
          <Gauge className="h-3 w-3 opacity-60" />
        </Link>

      </div>

      {/* Timer — centered as before */}
      <div ref={viewportRef} className="relative mx-auto flex h-full w-full items-center justify-center overflow-hidden py-2 sm:py-4">
        <div className="focus-scaled-frame flex items-center justify-center">
          <div
            ref={contentRef}
            className="focus-scaled-content group flex shrink-0 w-[min(92vw,44rem)] min-h-0 flex-col items-center justify-center gap-4 px-2 text-center sm:gap-6 sm:px-3"
          >
            <button
              type="button"
              data-testid="focus-timer-trigger"
              onClick={() => void handleTimerPress()}
              disabled={!canToggleTimer}
              aria-label={isRunning ? "أوقف المؤقت" : isInitialStudyState ? "ابدأ جلسة التركيز" : "شغّل المؤقت"}
              className={cn(
                "focus-timer-button relative grid aspect-square w-full max-w-[min(100%,clamp(12rem,28vw,20rem))] place-items-center rounded-full border border-white/70 transition",
                canToggleTimer
                  ? "cursor-pointer hover:scale-[1.01] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/20 active:scale-[0.99]"
                  : "cursor-default"
              )}
            >
              <div className="focus-timer-inner absolute inset-[clamp(0.35rem,0.8vw,0.55rem)] rounded-full" />
              <div className="relative flex flex-col items-center gap-2 text-center">
                <span className="text-xs font-medium text-ink/40">{timerLabel}</span>
                <span className="text-[clamp(2.4rem,6vw,3.8rem)] font-semibold tracking-tight text-ink">
                  {isInitialStudyState ? "ابدأ" : formatTime(remainingSeconds)}
                </span>
              </div>
            </button>

            <p className="text-[clamp(0.85rem,1.45vw,1rem)] font-medium text-muted opacity-0 transition-opacity duration-300 group-hover:opacity-100">{timerHint}</p>
            <p
              className="quran-text max-w-full px-2 text-[clamp(1.1rem,2.1vw,2.1rem)] font-bold leading-snug tracking-tight text-ink"
              title={currentQuote.text}
            >
              {currentQuote.text}
            </p>
            <p className="text-[clamp(0.72rem,1vw,0.85rem)] font-semibold text-muted">
              {currentQuote.source}
            </p>
          </div>
        </div>
      </div>

      <style jsx>{`
        .focus-scaled-frame {
          width: ${scaledFrameWidth};
          height: ${scaledFrameHeight};
        }

        .focus-scaled-content {
          flex-shrink: 0;
          transform: scale(${fitScale});
          transform-origin: center center;
        }

        .focus-timer-button {
          background: conic-gradient(${timerAccent} ${progress}%, ${timerTrack} ${progress}% 100%);
          box-shadow: ${timerShadow};
        }

        .focus-timer-inner {
          background: rgb(var(--surface));
        }

        .first-run-tour-spotlight {
          top: ${tourSpotlightTop};
          left: ${tourSpotlightLeft};
          width: ${tourSpotlightWidth};
          height: ${tourSpotlightHeight};
        }

        .first-run-tour-popover {
          top: ${tourPopoverMetrics.top};
          left: ${tourPopoverMetrics.left};
          width: ${tourPopoverMetrics.width};
          transform: ${tourPopoverMetrics.transform};
        }
      `}</style>

      {showFirstRunTour ? (
        <>
          <div className="pointer-events-none fixed inset-0 z-[70] bg-ink/45 backdrop-blur-[1px]" />

          {tourSpotlightMetrics ? (
            <div
              className="first-run-tour-spotlight pointer-events-none fixed z-[71] rounded-2xl border border-white/75 shadow-[0_0_0_9999px_rgba(17,24,39,0.58)] transition-all duration-300"
            />
          ) : null}

          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="first-run-tour-title"
            className="first-run-tour-popover glass-panel fixed z-[72] rounded-[1.35rem] px-4 py-4 text-right shadow-halo sm:px-5"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="rounded-full bg-accent/10 px-2.5 py-1 text-[11px] font-semibold text-accent sm:text-xs">
                {tourStepIndex + 1} / {FIRST_RUN_TOUR_STEPS.length}
              </span>
              <button
                type="button"
                onClick={finishFirstRunTour}
                className="rounded-full border border-line bg-surface/70 px-2.5 py-1 text-[11px] font-semibold text-muted transition hover:border-accent/30 hover:text-accent"
              >
                تخطي
              </button>
            </div>

            <h2 id="first-run-tour-title" className="mt-2 text-base font-semibold text-ink sm:text-lg">
              {currentTourStep.title}
            </h2>

            <p className="mt-2 text-xs leading-6 text-muted sm:text-sm sm:leading-7">{currentTourStep.description}</p>

            <div className="mt-4 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={goToPreviousTourStep}
                disabled={isFirstTourStep}
                className="inline-flex items-center rounded-full border border-line bg-surface/75 px-3 py-1.5 text-xs font-semibold text-ink transition hover:border-accent/30 hover:text-accent disabled:cursor-not-allowed disabled:opacity-50"
              >
                السابق
              </button>

              <button
                type="button"
                onClick={goToNextTourStep}
                className="inline-flex items-center rounded-full bg-ink px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-ink/90"
              >
                {isLastTourStep ? "إنهاء" : "التالي"}
              </button>
            </div>

            <div className="mt-3 flex items-center justify-center gap-1.5" aria-hidden="true">
              {FIRST_RUN_TOUR_STEPS.map((step, index) => (
                <span
                  key={step.id}
                  className={cn(
                    "h-1.5 w-1.5 rounded-full transition",
                    index === tourStepIndex ? "bg-accent" : "bg-line"
                  )}
                />
              ))}
            </div>

            {currentTourStep.id === "nav-reader" ? (
              <div className="mt-3 flex justify-end">
                <Link
                  href={lastReaderRoute}
                  onClick={finishFirstRunTour}
                  className="inline-flex items-center rounded-full border border-line bg-surface/75 px-3 py-1.5 text-xs font-semibold text-ink transition hover:border-accent/30 hover:text-accent"
                >
                  افتح القراءة الآن
                </Link>
              </div>
            ) : null}
          </div>
        </>
      ) : null}
    </section>
  );
}

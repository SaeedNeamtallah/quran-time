# توثيق الـ Algorithms

هذا الملف يشرح الخوارزميات الأساسية المستخدمة داخل التطبيق، بطريقة عملية قابلة للمراجعة والتطوير.

## 1) Gapless Audio Sequencer Algorithm

المكان الأساسي:

- `src/lib/hooks/use-gapless-sequencer.ts`

الهدف:

- تشغيل قائمة آيات صوتيًا بدون فجوات.
- الحفاظ على active verse + active word في الزمن الحقيقي.
- الاستمرار في التتبع حتى لو فشل decode لبعض المقاطع.

### فكرة عمل التمييز

الخوارزمية تحفظ مصفوفات حالة عامة:

- `tracks`: قائمة المقاطع الصوتية.
- `trackOffsets`: بداية كل مقطع على timeline موحد.
- `trackDurations`: مدة كل مقطع معتمدة على الصوت أو التوقيتات.
- `timings`: خريطة توقيت الكلمات لكل آية.

### خطوات التشغيل

1. `playStreamingSequence` ينظف الحالة القديمة ويجهز السياق الصوتي.
2. يتم تهيئة أول active verse/word من أول segment متاح.
3. `ensureBuffer` يقوم بالجدولة المسبقة لعدد مقاطع محدد (`PRELOAD_AHEAD_COUNT`).
4. لكل مقطع:
   - يحاول fetch + decode.
   - لو decode نجح: يتم حساب slice مناسب من البداية للنهاية.
   - لو decode فشل: يستخدم fallback timing-only duration حتى لا ينكسر التتبع.
5. `syncLoop` (باستخدام `requestAnimationFrame`) يحسب الموضع الحالي على timeline.
6. يتم تحديث:
   - `activeVerseKey` حسب المقطع النشط.
   - `activeWordSignature` حسب segment الذي يغطي الزمن الحالي.
7. عند نهاية آخر مقطع: stop + notify ended.

### ميزات الاستقرار

- حماية من التداخل عبر `isScheduling`.
- إنهاء آمن للمصادر الصوتية في `stopPlayback`.
- cache للمقاطع الصوتية لتقليل latency.
- fallback timing-based progression عند فشل decode.

### شبه كود

```text
playStreamingSequence(tracks, timings):
  stopPlayback()
  init state
  ensureBuffer()
  start syncLoop()

ensureBuffer():
  while not stopped and need_preload:
    buffer = fetchAndDecode(track.url)
    if buffer exists:
      duration = computeFrom(buffer, segments)
      schedule source at handoffTarget
    else:
      duration = computeFrom(segments or verseSpan)
    save offset + duration
    handoffTarget += duration

syncLoop():
  locate active track from (globalTime - offset)
  if active track found:
    set active verse
    set active word by segment interval
  else if passed end:
    stop + notifyEnded
  request next frame
```

## 2) Tafsir Text Highlight Algorithm

المكان الأساسي:

- `src/lib/utils/format.ts`
- `src/lib/constants/tafsir-highlights.ts`

الهدف:

- تقسيم نص التفسير إلى أجزاء.
- تمييز أجزاء محددة بالألوان حسب قواعد دلالية.

### فكرة العمل

الخوارزمية تبني Regex مركب بمجموعات مسماة (named groups) وبأولوية واضحة:

1. `redPriority`: آيات داخل أقواس أو مقاطع خاصة.
2. `gold` و `blue` و `purple`: مصطلحات تفسيرية/لغوية.
3. `green`: أسماء الأنبياء والصيغ المرتبطة بالصلاة عليهم.
4. `redSacred`: ألفاظ مقدسة مثل لفظ الجلالة ومشتقاته.

### خطوات معالجة التمييز

1. بناء patterns من قوائم terms مع escape آمن.
2. تشغيل regex على النص بالكامل (`matchAll`).
3. لكل match:
   - إضافة النص السابق كجزء `text` عادي.
   - تحديد النوع الملون حسب أولوية الـ groups.
4. إضافة أي ذيل نصي متبقٍ كجزء `text`.
5. إرجاع list of parts للاستخدام في render.

### نتيجة الخوارزمية

كل جزء يُعاد بالشكل:

- `id`
- `text`
- `type` (`text | red | green | purple | blue | gold`)
- `highlighted`

وهذا يسمح لواجهة التفسير بإخراج تلوين دقيق دون فقدان ترتيب النص الأصلي.

## 3) Downloaded Mushaf Dataset Algorithm

المكان الأساسي:

- `scripts/download-mushaf-data.mjs`

الهدف:

- تنزيل صفحات المصحف (604) من API.
- تطبيع البيانات وتكوين ناتج موحد (pages + rubs + verse_sequence).

### فكرة عمل تنزيل المصحف

الخوارزمية تنفذ على ثلاث مراحل:

1. Fetch: جلب آيات كل صفحة مع pagination و retry.
2. Normalize: توحيد شكل الآية والكلمة (حقول رقمية ونصية آمنة).
3. Aggregate: بناء buckets للأرباع + تسلسل الآيات النهائي.

### خطوات معالجة تنزيل المصحف

1. قراءة الخيارات (`concurrency`, `retries`, `output`).
2. تشغيل `mapWithConcurrency` على الصفحات 1..604.
3. لكل صفحة:
   - fetch paginated verses.
   - normalize لكل verse و word.
4. بعد اكتمال الصفحات:
   - `buildRubsFromPages` لتجميع الآيات في 240 ربع.
   - استخراج `verse_sequence` بترتيب الصفحات.
5. كتابة الناتج JSON في المسار المحدد.

### مخرجات الخوارزمية

الملف النهائي يحتوي:

- `schema_version`
- `generated_at`
- `source`
- `pages`
- `rubs`
- `verse_sequence`

### ملاحظات أداء

- دعم concurrency لتقليل زمن التحميل.
- retry تدريجي للتعامل مع أخطاء الشبكة المؤقتة.
- تطبيع القيم يحمي من البيانات الناقصة أو غير المتوقعة.

## 4) نقاط تحسين مستقبلية مقترحة

- إضافة metric hooks لقياس drift بين audio time وword timing.
- اعتماد regex profiling لنصوص تفسير كبيرة جدًا.
- إضافة checksum لملف mushaf offline للتحقق من سلامة البيانات قبل التشغيل.

import { describe, expect, it } from "vitest";

import { formatTime, highlightTafsirText, splitPlainTextIntoParagraphs } from "@/lib/utils/format";

describe("format utilities", () => {
  it("formats seconds into mm:ss", () => {
    expect(formatTime(0)).toBe("00:00");
    expect(formatTime(65)).toBe("01:05");
  });

  it("splits plain tafsir text into readable paragraphs", () => {
    const paragraphs = splitPlainTextIntoParagraphs("الأول. الثاني. الثالث.\n\nالرابع.");
    expect(paragraphs).toEqual(["الأول. الثاني. الثالث.", "الرابع."]);
  });

  it("marks parenthetical fragments for highlighting", () => {
    const parts = highlightTafsirText("هذا نص (مميز) للتجربة");
    expect(parts.some((part) => part.type === "red" && part.text === "(مميز)")).toBe(true);
  });

  it("keeps ayat and quoted fragments red", () => {
    const parts = highlightTafsirText("﴿الحمد لله رب العالمين﴾ \"معنى ذلك\"");

    expect(parts.some((part) => part.type === "red" && part.text.includes("الحمد لله"))).toBe(true);
    expect(parts.some((part) => part.type === "red" && part.text.includes("\"معنى ذلك\""))).toBe(true);
  });

  it("assigns purple and blue keyword groups", () => {
    const parts = highlightTafsirText("المخاطب ومنه قول الشاعر");

    expect(parts.some((part) => part.type === "purple" && part.text.includes("المخاطب"))).toBe(true);
    expect(parts.some((part) => part.type === "blue" && part.text.includes("ومنه قول الشاعر"))).toBe(true);
  });

  it("prioritizes strongest tafsir markers as gold", () => {
    const parts = highlightTafsirText("قال ابن عباس نزلت هذه الآية في مكة والله أعلم");

    expect(parts.some((part) => part.type === "gold" && part.text.includes("قال ابن عباس"))).toBe(true);
    expect(parts.some((part) => part.type === "gold" && part.text.includes("نزلت هذه الآية في"))).toBe(true);
    expect(parts.some((part) => part.type === "gold" && part.text.includes("والله أعلم"))).toBe(true);
  });

  it("highlights divine majesty expressions in red", () => {
    const parts = highlightTafsirText("الله سبحانه وتعالى هو الحق");

    expect(parts.some((part) => part.type === "red" && part.text.includes("الله"))).toBe(true);
    expect(parts.some((part) => part.type === "red" && part.text.includes("سبحانه وتعالى"))).toBe(true);
  });

  it("highlights prophet names and salat formulas in green", () => {
    const parts = highlightTafsirText("موسى عليه السلام ومحمد صلى الله عليه وسلم");

    expect(parts.some((part) => part.type === "green" && part.text.includes("موسى"))).toBe(true);
    expect(parts.some((part) => part.type === "green" && part.text.includes("عليه السلام"))).toBe(true);
    expect(parts.some((part) => part.type === "green" && part.text.includes("محمد"))).toBe(true);
    expect(parts.some((part) => part.type === "green" && part.text.includes("صلى الله عليه وسلم"))).toBe(true);
  });

  it("highlights semicolon and double-semicolon wrapped fragments in heavy red", () => {
    const parts = highlightTafsirText("قبل ;نص داخل سيمي كولون; وبعد ;;نص داخل دبل سيمي كولون;;");

    expect(parts.some((part) => part.type === "red" && part.text === ";نص داخل سيمي كولون;")).toBe(true);
    expect(parts.some((part) => part.type === "red" && part.text === ";;نص داخل دبل سيمي كولون;;")).toBe(true);
  });
});

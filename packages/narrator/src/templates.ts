/**
 * Templated fallback text — used when the narrator is off, no model is
 * installed, or model output fails schema validation. Deterministic, built
 * only from the supplied numbers. Outlets are fictional.
 */

import type { Lang, NarratorInput, NarratorOutput, Tone } from "./types";

const OUTLETS: Record<Lang, string[]> = {
  he: ["הקול היומי", "מבט כלכלי", "חדשות הערוץ התשיעי"],
  en: ["The Daily Voice", "Economic Observer", "Channel Nine News"],
};

function fmt(v: number, unit: string): string {
  const num = Math.abs(v) >= 100 ? v.toFixed(0) : Math.abs(v) >= 10 ? v.toFixed(1) : v.toFixed(2);
  return `${num}${unit}`;
}

function toneFor(name: string, delta: number): Tone {
  const badWhenUp = /unemployment|inflation|deficit|debt|protest|poverty/.test(name);
  const improving = badWhenUp ? delta < 0 : delta > 0;
  if (Math.abs(delta) < 1e-9) return "neutral";
  return improving ? "supportive" : "critical";
}

const METRIC_LABEL: Record<Lang, Record<string, string>> = {
  he: {
    gdp_growth: "צמיחת התוצר", unemployment: "האבטלה", inflation: "האינפלציה",
    deficit_gdp: "הגירעון", debt_gdp: "יחס החוב-תוצר", cohesion: "הלכידות החברתית", protest: "עוצמת המחאה",
  },
  en: {
    gdp_growth: "GDP growth", unemployment: "unemployment", inflation: "inflation",
    deficit_gdp: "the deficit", debt_gdp: "debt-to-GDP", cohesion: "social cohesion", protest: "protest intensity",
  },
};

export function templateNarration(input: NarratorInput): NarratorOutput {
  const { lang } = input;
  const outlets = OUTLETS[lang];
  const labels = METRIC_LABEL[lang];

  if (input.red_line) {
    // CONTRACT C6: consequence-reporting register — no strategy talk, no triumph.
    const casualties = Math.round(input.war_casualties);
    const evNote = input.events.find((e) => e.id.startsWith("red_line") || e.id === "military_collapse")?.note ?? "";
    return {
      headlines: [
        {
          outlet: outlets[0],
          tone: "alarmed",
          text: lang === "he"
            ? `הרבעון מסתיים תחת צל האירועים. נפגעים עד כה: ${casualties.toLocaleString()}. ${evNote.slice(0, 140)}`
            : `The quarter closes under the weight of events. Casualties to date: ${casualties.toLocaleString()}. ${evNote.slice(0, 140)}`,
        },
      ],
      minister_quotes: [],
      street_mood: lang === "he"
        ? "הרחוב שקט. לא שקט של רגיעה — שקט של בתים שסופרים את מחירם של הדברים."
        : "The streets are quiet. Not the quiet of calm — the quiet of households counting the cost.",
    };
  }

  // Rank metric moves by |delta| and write one headline per top mover.
  const movers = Object.entries(input.deltas)
    .filter(([, d]) => Math.abs(d.delta) > 1e-9)
    .sort((a, b) => Math.abs(b[1].delta) - Math.abs(a[1].delta))
    .slice(0, 3);

  const headlines = movers.map(([name, d], i) => {
    const label = labels[name] ?? name;
    const dir = d.delta > 0 ? (lang === "he" ? "עולה" : "rises") : (lang === "he" ? "יורדת" : "falls");
    return {
      outlet: outlets[i % outlets.length],
      tone: toneFor(name, d.delta),
      text: lang === "he"
        ? `${label} ${dir} ל-${fmt(d.value, d.unit)} (${d.delta > 0 ? "+" : ""}${fmt(d.delta, d.unit)})`
        : `${label} ${dir} to ${fmt(d.value, d.unit)} (${d.delta > 0 ? "+" : ""}${fmt(d.delta, d.unit)})`,
    };
  });
  for (const ev of input.events.slice(0, 2)) {
    headlines.push({
      outlet: outlets[headlines.length % outlets.length],
      tone: "neutral",
      text: lang === "he" ? `דיווח: ${ev.note.slice(0, 200)}` : `Report: ${ev.note.slice(0, 200)}`,
    });
  }
  if (headlines.length === 0) {
    headlines.push({
      outlet: outlets[0],
      tone: "neutral",
      text: lang === "he" ? "רבעון שגרתי: המדדים המרכזיים כמעט ללא שינוי." : "A routine quarter: headline indicators barely moved.",
    });
  }

  const gdp = input.deltas.gdp_growth;
  const quotes = gdp
    ? [{
        role: lang === "he" ? "שר האוצר" : "Finance Minister",
        text: lang === "he"
          ? `הנתונים מדברים בעד עצמם: ${fmt(gdp.value, gdp.unit)} צמיחה. נמשיך באחריות תקציבית.`
          : `The numbers speak for themselves: ${fmt(gdp.value, gdp.unit)} growth. We will continue with fiscal responsibility.`,
      }]
    : [];

  const moods = Object.values(input.sector_moods);
  const avg = moods.length > 0 ? moods.reduce((a, b) => a + b, 0) / moods.length : 0.5;
  const street_mood =
    avg > 0.45
      ? lang === "he" ? "אווירה סבירה ברחוב; רוב הציבור עסוק בענייני היומיום." : "A tolerable public mood; most people are busy with daily life."
      : avg > 0.3
        ? lang === "he" ? "מורת רוח שקטה: שיחות מטבח על יוקר, ביטחון ומי אשם." : "Quiet discontent: kitchen-table talk of costs, security, and who is to blame."
        : lang === "he" ? "הרחוב רותח; אמון הציבור בהנהגה נמוך והמחאה מוצאת קהל." : "The street is seething; trust in the leadership is low and protest finds an audience.";

  return { headlines: headlines.slice(0, 6), minister_quotes: quotes, street_mood };
}

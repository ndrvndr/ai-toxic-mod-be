const LEETSPEAK_MAP: Record<string, string> = {
  "1": "i",
  "3": "e",
  "4": "a",
  "0": "o",
  "7": "t",
  "5": "s",
  "@": "a",
  $: "s",
};

export function normalizeText(text: string): string {
  const lowercased = text.toLowerCase();

  const leetReplaced = lowercased.replace(
    /[134705$@]/g,
    (match) => LEETSPEAK_MAP[match] ?? match,
  );

  return leetReplaced
    .replace(/[^a-z\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

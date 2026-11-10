/**
 * Language understanding step: detects Bengali script, Banglish
 * (romanized Bengali) or English. Mixed Bengali+English counts as Bengali
 * when Bengali script is significant.
 */
import type { Language } from "../config/types";

const BANGLISH_WORDS = [
  "amar", "amader", "ami", "amra", "apni", "tumi", "tomar", "oder", "tader", "jonno", "jnno", "er", "ekta", "ekti",
  "banao", "banai", "koro", "korbe", "korte", "korechi", "korsi", "korlam", "kori", "hobe", "hbe", "lagbe", "chai",
  "ache", "ase", "achhe", "jon", "kaj", "kaaj", "dekhte", "dekhbo", "moddhe", "modhe", "kore", "dao", "daw",
  "ajke", "aj", "kal", "gulo", "golo", "theke", "porjonto", "shob", "sob", "ta", "ti", "na", "nai", "nei",
  "baki", "kichu", "onek", "valo", "bhalo", "add", "remove", "lagbe", "thakbe", "jabe", "pathao", "chaai",
];

export function detectLanguage(text: string): Language {
  const letters = text.replace(/[\s\d\p{P}\p{S}]/gu, "");
  if (!letters.length) return "en";
  const bengali = (letters.match(/[ঀ-৿]/g) ?? []).length;
  if (bengali / letters.length > 0.2) return "bn";
  const words = text.toLowerCase().match(/[a-z]+/g) ?? [];
  if (!words.length) return "en";
  const hits = words.filter((w) => BANGLISH_WORDS.includes(w)).length;
  if (hits >= 2 || hits / words.length > 0.15) return "banglish";
  return "en";
}

export const LANGUAGE_LABEL: Record<Language, string> = {
  bn: "বাংলা (Bengali)",
  banglish: "Banglish",
  en: "English",
};

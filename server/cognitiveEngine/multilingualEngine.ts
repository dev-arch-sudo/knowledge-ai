/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Lightweight corpus-agnostic multilingual query normalization.
 * This is intentionally a deterministic retrieval helper, not a replacement
 * for a full translation model. It translates common question/business terms
 * while preserving names, codes, numbers, and user-provided entities.
 */

import { LanguageDetectionResult } from './types.js';

export interface MultilingualTranslationResult {
  originalQuery: string;
  detectedLanguage: LanguageDetectionResult;
  normalizedEnglishQuery: string;
  extractedEnglishEntities: string[];
}

type Profile = {
  code: string;
  name: string;
  script: string;
  markers: string[];
  pattern?: RegExp;
};

const PROFILES: Profile[] = [
  { code: 'es', name: 'Spanish', script: 'Latin', markers: ['¿', 'cuántos', 'cuánto', 'cuál', 'dónde', 'qué', 'precio', 'oficina', 'política', 'días'], pattern: /\b(el|la|los|las|del|una|para|con)\b/i },
  { code: 'fr', name: 'French', script: 'Latin', markers: ['combien', 'quel', 'quelle', 'où', 'politique', 'bureau', 'prix', 'jours'], pattern: /\b(le|la|les|des|pour|avec|dans)\b/i },
  { code: 'de', name: 'German', script: 'Latin', markers: ['wie viele', 'welche', 'wo', 'richtlinie', 'büro', 'preis', 'tage'], pattern: /\b(der|die|das|und|für|mit|von)\b/i },
  { code: 'pt', name: 'Portuguese', script: 'Latin', markers: ['quantos', 'quanto', 'qual', 'onde', 'política', 'escritório', 'preço', 'dias'], pattern: /\b(o|a|os|as|para|com|dos|das)\b/i },
  { code: 'it', name: 'Italian', script: 'Latin', markers: ['quanti', 'quanto', 'quale', 'dove', 'politica', 'ufficio', 'prezzo', 'giorni'], pattern: /\b(il|la|i|gli|le|per|con|dei)\b/i },
  { code: 'hi', name: 'Hindi', script: 'Devanagari', markers: ['कितने', 'कितनी', 'कहाँ', 'क्या', 'नीति', 'कार्यालय', 'दिन'] },
  { code: 'ne', name: 'Nepali', script: 'Devanagari', markers: ['कति', 'कहाँ', 'कुन', 'के', 'नीति', 'कार्यालय', 'दिन', 'बिदा'] },
  { code: 'ru', name: 'Russian', script: 'Cyrillic', markers: ['сколько', 'какой', 'где', 'политика', 'офис', 'дней'] },
  { code: 'ar', name: 'Arabic', script: 'Arabic', markers: ['كم', 'ما', 'أين', 'سياسة', 'مكتب', 'أيام'] },
  { code: 'zh', name: 'Chinese', script: 'Han', markers: ['多少', '哪个', '哪里', '政策', '办公室', '天'] },
  { code: 'ja', name: 'Japanese', script: 'Kana/Kanji', markers: ['いくつ', 'どの', 'どこ', 'ポリシー', 'オフィス', '日'] },
];

const TRANSLATIONS: Record<string, string> = {
  'cuántos': 'how many', 'cuánto': 'how much', 'cuál': 'which', 'dónde': 'where', 'qué': 'what', 'días': 'days', 'política': 'policy', 'oficina': 'office', 'precio': 'price', 'total': 'total',
  'combien': 'how many', 'quel': 'which', 'quelle': 'which', 'où': 'where', 'politique': 'policy', 'bureau': 'office', 'prix': 'price', 'jours': 'days',
  'wie viele': 'how many', 'welche': 'which', 'wo': 'where', 'richtlinie': 'policy', 'büro': 'office', 'preis': 'price', 'tage': 'days',
  'quantos': 'how many', 'quanto': 'how much', 'qual': 'which', 'onde': 'where', 'escritório': 'office', 'preço': 'price', 'dias': 'days',
  'quanti': 'how many', 'quale': 'which', 'dove': 'where', 'politica': 'policy', 'ufficio': 'office', 'prezzo': 'price', 'giorni': 'days',
  'कितने': 'how many', 'कितनी': 'how many', 'कहाँ': 'where', 'क्या': 'what', 'नीति': 'policy', 'कार्यालय': 'office', 'दिन': 'days',
  'कति': 'how many', 'कुन': 'which', 'के': 'what', 'बिदा': 'leave',
  'сколько': 'how many', 'какой': 'which', 'где': 'where', 'политика': 'policy', 'офис': 'office', 'дней': 'days',
  'كم': 'how many', 'ما': 'what', 'أين': 'where', 'سياسة': 'policy', 'مكتب': 'office', 'أيام': 'days',
  '多少': 'how many', '哪个': 'which', '哪里': 'where', '政策': 'policy', '办公室': 'office', '天': 'days',
  'いくつ': 'how many', 'どの': 'which', 'どこ': 'where', 'ポリシー': 'policy', 'オフィス': 'office', '日': 'days',
};

export class MultilingualEngine {
  public detectLanguage(text: string): LanguageDetectionResult {
    const trimmed = text.trim();
    const lower = trimmed.toLowerCase();

    const scriptMatch = (() => {
      if (/[\u0600-\u06FF]/.test(trimmed)) return PROFILES.find((profile) => profile.code === 'ar');
      if (/[\u4E00-\u9FFF]/.test(trimmed) && !/[\u3040-\u30FF]/.test(trimmed)) return PROFILES.find((profile) => profile.code === 'zh');
      if (/[\u3040-\u30FF]/.test(trimmed)) return PROFILES.find((profile) => profile.code === 'ja');
      if (/[\u0400-\u04FF]/.test(trimmed)) return PROFILES.find((profile) => profile.code === 'ru');
      if (/[\u0900-\u097F]/.test(trimmed)) {
        const nepaliScore = ['कति', 'कुन', 'बिदा'].filter((marker) => trimmed.includes(marker)).length;
        return PROFILES.find((profile) => profile.code === (nepaliScore > 0 ? 'ne' : 'hi'));
      }
      return undefined;
    })();

    if (scriptMatch) {
      return {
        languageCode: scriptMatch.code,
        languageName: scriptMatch.name,
        confidence: 0.95,
        script: scriptMatch.script,
        isCorpusLanguage: false,
      };
    }

    let best: { profile?: Profile; score: number } = { score: 0 };
    for (const profile of PROFILES.filter((candidate) => candidate.script === 'Latin')) {
      let score = 0;
      for (const marker of profile.markers) if (lower.includes(marker)) score += marker.length > 3 ? 2 : 1;
      if (profile.pattern?.test(lower)) score += 1;
      if (score > best.score) best = { profile, score };
    }

    if (best.profile && best.score >= 2) {
      return {
        languageCode: best.profile.code,
        languageName: best.profile.name,
        confidence: Math.min(0.95, 0.7 + best.score * 0.05),
        script: best.profile.script,
        isCorpusLanguage: false,
      };
    }

    return {
      languageCode: 'en',
      languageName: 'English',
      confidence: 0.95,
      script: 'Latin',
      isCorpusLanguage: true,
    };
  }

  public normalizeQueryForRetrieval(
    rawQuery: string,
    detectedLang: LanguageDetectionResult
  ): { retrievalQuery: string; extractedKeywords: string[] } {
    if (detectedLang.isCorpusLanguage || detectedLang.languageCode === 'en') {
      return { retrievalQuery: rawQuery, extractedKeywords: [] };
    }

    let normalized = rawQuery.toLowerCase();
    const extractedKeywords: string[] = [];
    const entries = Object.entries(TRANSLATIONS).sort((a, b) => b[0].length - a[0].length);
    for (const [source, target] of entries) {
      if (normalized.includes(source.toLowerCase())) {
        normalized = normalized.split(source.toLowerCase()).join(target);
        extractedKeywords.push(target);
      }
    }

    const preserved = rawQuery.match(/\b[A-Z]{2,}[A-Z0-9\-]*\d+[A-Z0-9\-]*\b/g) || [];
    for (const value of preserved) {
      if (!normalized.toLowerCase().includes(value.toLowerCase())) normalized += ` ${value}`;
      extractedKeywords.push(value);
    }

    return { retrievalQuery: normalized.trim(), extractedKeywords: Array.from(new Set(extractedKeywords)) };
  }

  public localizeAnswer(
    answer: string,
    detectedLang: LanguageDetectionResult,
    isRefusal: boolean = false
  ): string {
    if (detectedLang.isCorpusLanguage || detectedLang.languageCode === 'en') return answer;
    if (!isRefusal) return answer;

    const refusals: Record<string, string> = {
      es: 'EVIDENCIA INSUFICIENTE: Los documentos cargados no contienen evidencia suficiente para responder con fiabilidad.',
      fr: 'PREUVES INSUFFISANTES : Les documents importés ne contiennent pas assez de preuves pour répondre de manière fiable.',
      de: 'UNZUREICHENDE BELEGE: Die hochgeladenen Dokumente enthalten nicht genügend Belege für eine zuverlässige Antwort.',
      pt: 'EVIDÊNCIAS INSUFICIENTES: Os documentos enviados não contêm evidências suficientes para responder com segurança.',
      it: 'PROVE INSUFFICIENTI: I documenti caricati non contengono prove sufficienti per rispondere in modo affidabile.',
      hi: 'अपर्याप्त साक्ष्य: अपलोड किए गए दस्तावेज़ों में विश्वसनीय उत्तर के लिए पर्याप्त साक्ष्य नहीं हैं।',
      ne: 'अपर्याप्त प्रमाण: अपलोड गरिएका कागजातमा भरपर्दो उत्तर दिन पर्याप्त प्रमाण छैन।',
      ru: 'НЕДОСТАТОЧНО ДОКАЗАТЕЛЬСТВ: В загруженных документах недостаточно данных для надежного ответа.',
      ar: 'أدلة غير كافية: لا تحتوي المستندات المرفوعة على أدلة كافية لتقديم إجابة موثوقة.',
      zh: '证据不足：上传的文档没有足够证据支持可靠回答。',
      ja: '根拠不十分: アップロードされた文書には、信頼できる回答に十分な根拠がありません。',
    };
    return refusals[detectedLang.languageCode] || answer;
  }
}

export const multilingualEngine = new MultilingualEngine();

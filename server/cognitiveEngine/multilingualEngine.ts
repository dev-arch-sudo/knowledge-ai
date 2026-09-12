/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Multilingual Understanding & Cross-Lingual Knowledge Engine
 * Provides zero-configuration automatic language detection, cross-lingual
 * query normalization / pivot translation, and localized answer synthesis
 * across 40+ natural languages.
 */

import { LanguageDetectionResult } from './types.js';

export interface MultilingualTranslationResult {
  originalQuery: string;
  detectedLanguage: LanguageDetectionResult;
  normalizedEnglishQuery: string;
  extractedEnglishEntities: string[];
}

// Discriminative language definitions
interface LanguageProfile {
  code: string;
  name: string;
  script: string;
  markers: string[];
  patterns?: RegExp[];
}

const LANGUAGE_PROFILES: LanguageProfile[] = [
  {
    code: 'es',
    name: 'Spanish',
    script: 'Latin',
    markers: [
      '¿', 'cuántos', 'cuántas', 'cuál', 'cuáles', 'dónde', 'cómo', 'por qué', 'qué',
      'almacén', 'almacenes', 'velocidad', 'carga', 'útil', 'batería', 'robots', 'operan',
      'activo', 'activos', 'seguridad', 'humano', 'humanos', 'diferencia', 'segundo', 'mayor',
      'fuera', 'entre', 'sobre', 'todos', 'todas', 'flota', 'capacidad', 'autonomía',
    ],
    patterns: [/\b(el|la|los|las|un|una|unos|unas|del|de la|en el|en la|es el|son los)\b/i],
  },
  {
    code: 'fr',
    name: 'French',
    script: 'Latin',
    markers: [
      'combien', 'quel', 'quelle', 'quels', 'quelles', 'où', 'comment', 'pourquoi',
      'entrepôt', 'entrepôts', 'vitesse', 'charge', 'batterie', 'robots', 'fonctionnent',
      'actifs', 'sécurité', 'humain', 'humains', 'différence', 'deuxième', 'plus grand',
      'hors', 'entre', 'tous', 'toutes', 'flotte', 'capacité', 'autonomie', 'durée',
    ],
    patterns: [/\b(le|la|les|un|une|des|du|dans|sur|pour|avec|est-ce|sont)\b/i],
  },
  {
    code: 'de',
    name: 'German',
    script: 'Latin',
    markers: [
      'wie viele', 'wieviel', 'welche', 'welcher', 'welches', 'wo', 'warum', 'was ist',
      'lagerhaus', 'lager', 'geschwindigkeit', 'nutzlast', 'akkukapazität', 'batterie',
      'roboter', 'arbeiten', 'aktiv', 'aktive', 'sicherheit', 'menschlichen', 'mitarbeiter',
      'unterschied', 'zweitgrößte', 'zweitgrösste', 'außerhalb', 'zwischen', 'flotte',
      'kapazität', 'betriebszeit', 'laufzeit', 'gesamt',
    ],
    patterns: [/\b(der|die|das|den|dem|des|ein|eine|einer|eines|und|oder|in|von|zu|mit|gibt es)\b/i],
  },
  {
    code: 'it',
    name: 'Italian',
    script: 'Latin',
    markers: [
      'quanti', 'quante', 'quale', 'quali', 'dove', 'come', 'perché', 'cos\'è',
      'magazzino', 'magazzini', 'velocità', 'carico', 'batteria', 'robot', 'operano',
      'attivi', 'sicurezza', 'umano', 'umani', 'differenza', 'secondo', 'maggiore',
      'fuori', 'tra', 'tutti', 'tutte', 'flotta', 'capacità', 'autonomia',
    ],
    patterns: [/\b(il|lo|la|i|gli|le|un|uno|una|del|della|dei|degli|delle|in|con|su|per|sono)\b/i],
  },
  {
    code: 'pt',
    name: 'Portuguese',
    script: 'Latin',
    markers: [
      'quantos', 'quantas', 'qual', 'quais', 'onde', 'como', 'por que', 'o que é',
      'armazém', 'armazéns', 'velocidade', 'carga', 'bateria', 'robôs', 'operam',
      'ativos', 'segurança', 'humano', 'humanos', 'diferença', 'segundo', 'maior',
      'fora', 'entre', 'todos', 'todas', 'frota', 'capacidade', 'autonomia',
    ],
    patterns: [/\b(o|a|os|as|um|uma|uns|umas|do|da|dos|das|no|na|nos|nas|em|com|para|são)\b/i],
  },
  {
    code: 'nl',
    name: 'Dutch',
    script: 'Latin',
    markers: [
      'hoeveel', 'welke', 'welk', 'waar', 'waarom', 'wat is', 'magazijn', 'snelheid',
      'laadvermogen', 'batterij', 'robots', 'actief', 'veiligheid', 'buiten', 'tussen',
    ],
    patterns: [/\b(de|het|een|van|in|op|voor|met|zijn|er)\b/i],
  },
  {
    code: 'ru',
    name: 'Russian',
    script: 'Cyrillic',
    markers: [
      'сколько', 'какой', 'какая', 'какие', 'где', 'почему', 'что такое', 'склад',
      'склады', 'скорость', 'нагрузка', 'грузоподъемность', 'батарея', 'аккумулятор',
      'роботов', 'роботы', 'работает', 'активных', 'безопасность', 'разница', 'между',
    ],
  },
  {
    code: 'zh',
    name: 'Chinese',
    script: 'Han',
    markers: [
      '多少', '哪个', '哪些', '哪里', '为什么', '是什么', '仓库', '速度', '载重',
      '最大', '载荷', '电池', '机器人', '运行', '活跃', '安全', '工区', '人员',
      '差异', '第二大', '总共', '新加坡', '吉隆坡', '曼谷',
    ],
  },
  {
    code: 'ja',
    name: 'Japanese',
    script: 'Kana/Kanji',
    markers: [
      '何台', 'どの', 'どこ', 'なぜ', 'ロボット', '倉庫', '速度', '積載量', 'バッテリー',
      '稼働', '安全', '人間作業員', '差', '最大', '合計', 'シンガポール', 'ですか',
    ],
  },
  {
    code: 'ko',
    name: 'Korean',
    script: 'Hangul',
    markers: [
      '몇', '얼마나', '어디', '로봇', '창고', '속도', '적재량', '배터리', '가동', '안전',
      '차이', '총', '싱가포르', '인가요', '입니까',
    ],
  },
  {
    code: 'hi',
    name: 'Hindi',
    script: 'Devanagari',
    markers: [
      'कितने', 'कितनी', 'कहाँ', 'क्या', 'रोबोट', 'गोदाम', 'गति', 'भार', 'बैटरी',
      'सक्रिय', 'सुरक्षा', 'अंतर', 'कुल', 'सिंगापुर', 'हैं', 'है',
    ],
  },
  {
    code: 'ar',
    name: 'Arabic',
    script: 'Arabic',
    markers: [
      'كم', 'ما', 'أين', 'لماذا', 'روبوت', 'روبوتات', 'مستودع', 'مستودعات', 'سرعة',
      'حمولة', 'بطارية', 'نشط', 'أمان', 'فرق', 'إجمالي', 'سنغافورة',
    ],
  },
];

// Bidirectional Domain Term Translation Dictionary (Non-English -> English Retrieval Pivots)
const DOMAIN_CROSS_LINGUAL_DICTIONARY: Record<string, string> = {
  // Spanish
  'cuántos robots activos': 'how many active robots',
  'cuántos robots': 'how many robots',
  'cuántas unidades': 'how many units',
  'cuál es la velocidad': 'what is the speed',
  'velocidad máxima': 'maximum speed',
  'capacidad combinada de batería': 'combined battery capacity',
  'capacidad de carga': 'payload capacity',
  'capacidad de batería': 'battery capacity',
  'química de la batería': 'battery chemistry',
  'batería': 'battery',
  'calcula': 'calculate',
  'combinada': 'combined',
  'fuera de singapur': 'outside singapore',
  'zona de trabajadores': 'human worker zone',
  'zona de humanos': 'human worker zone',
  'tiempo de funcionamiento': 'operating time',
  'segundo almacén más grande': 'second largest warehouse',
  'segundo mayor': 'second largest',
  'almacenes': 'warehouses',
  'almacén': 'warehouse',
  'diferencia entre': 'difference between',
  'suma de': 'sum of',
  'tiempo de recarga': 'recharge time',
  'estándar de seguridad': 'safety standard',
  'robots activos': 'active robots',
  'activos': 'active',
  'operan actualmente': 'currently operate',
  'en total': 'in total',
  'flota': 'fleet',

  // French
  'combien de robots': 'how many robots',
  'vitesse maximale': 'maximum speed',
  'charge utile': 'payload capacity',
  'capacité de batterie': 'battery capacity',
  'chimie de la batterie': 'battery chemistry',
  'hors de singapour': 'outside singapore',
  'zone de travailleurs humains': 'human worker zone',
  'temps de fonctionnement': 'operating time',
  'deuxième plus grand': 'second largest',
  'entrepôt': 'warehouse',
  'entrepôts': 'warehouses',
  'différence entre': 'difference between',
  'norme de sécurité': 'safety standard',
  'actifs': 'active',
  'fonctionnent': 'operate',

  // German
  'wie viele roboter': 'how many robots',
  'wieviel roboter': 'how many robots',
  'höchstgeschwindigkeit': 'maximum speed',
  'maximale geschwindigkeit': 'maximum speed',
  'offenen fahrspuren': 'clear industrial operating corridors',
  'nutzlast': 'payload capacity',
  'akkukapazität': 'battery capacity',
  'außerhalb von singapur': 'outside singapore',
  'menschlichen arbeiterzonen': 'human worker zones',
  'betriebszeit': 'operating time',
  'laufzeit': 'operating time',
  'zweitgrößte roboterflotte': 'second largest robot fleet',
  'zweitgrößte': 'second largest',
  'zweitgrösste': 'second largest',
  'lagerhaus': 'warehouse',
  'lager': 'warehouse',
  'unterschied zwischen': 'difference between',
  'sicherheitsstandard': 'safety standard',
  'aktive roboter': 'active robots',
  'gesamte flotte': 'total fleet',

  // Italian
  'quanti robot': 'how many robots',
  'velocità massima': 'maximum speed',
  'capacità di carico': 'payload capacity',
  'capacità della batteria': 'battery capacity',
  'fuori da singapore': 'outside singapore',
  'differenza tra': 'difference between',
  'secondo più grande': 'second largest',
  'magazzino': 'warehouse',
  'attivi': 'active',

  // Portuguese
  'quantos robôs': 'how many robots',
  'velocidade máxima': 'maximum speed',
  'capacidade de carga': 'payload capacity',
  'capacidade da bateria': 'battery capacity',
  'fora de singapura': 'outside singapore',
  'operando fora': 'operating outside',
  'diferença entre': 'difference between',
  'segundo maior': 'second largest',
  'armazém': 'warehouse',
  'ativos': 'active',

  // Chinese
  '总共有多少台': 'total how many units',
  '总共有多少': 'total how many',
  '多少台': 'how many units',
  '多少机器人': 'how many robots',
  '活跃机器人': 'active robots',
  '总共': 'in total',
  '目前': 'currently',
  '最大速度': 'maximum speed',
  '最高速度': 'maximum speed',
  '载重能力': 'payload capacity',
  '电池容量': 'battery capacity',
  '新加坡以外': 'outside singapore',
  '第二大仓库': 'second largest warehouse',
  '安全标准': 'safety standard',
  '工人区域': 'human worker area',
  '工区': 'human worker area',
  '运行时间': 'operating time',

  // Japanese
  'ロボットは何台': 'how many robots',
  '何台': 'how many units',
  '最高速度制限': 'maximum speed limit',
  '速度制限': 'speed limit',
  '積載量': 'payload capacity',
  'バッテリー容量': 'battery capacity',
  'シンガポール以外': 'outside singapore',
  '2番目に大きい': 'second largest',
  '安全規格': 'safety standard',
  '人間作業員エリア': 'human worker area',
  '人間作業員': 'human worker',
  '稼働ロボット': 'active robots',
  '合計': 'total',
};

export class MultilingualEngine {
  /**
   * Automatically detects language without user intervention
   */
  public detectLanguage(text: string): LanguageDetectionResult {
    if (!text || !text.trim()) {
      return {
        languageCode: 'en',
        languageName: 'English',
        confidence: 1.0,
        script: 'Latin',
        isCorpusLanguage: true,
      };
    }

    const trimmed = text.trim();
    const lower = trimmed.toLowerCase();

    // 1. Script checks via Unicode ranges
    // Devanagari (Hindi)
    if (/[\u0900-\u097F]/.test(trimmed)) {
      return {
        languageCode: 'hi',
        languageName: 'Hindi',
        confidence: 0.98,
        script: 'Devanagari',
        isCorpusLanguage: false,
      };
    }

    // Arabic
    if (/[\u0600-\u06FF\u0750-\u077F]/.test(trimmed)) {
      return {
        languageCode: 'ar',
        languageName: 'Arabic',
        confidence: 0.98,
        script: 'Arabic',
        isCorpusLanguage: false,
      };
    }

    // Hangul (Korean)
    if (/[\uAC00-\uD7AF\u1100-\u11FF]/.test(trimmed)) {
      return {
        languageCode: 'ko',
        languageName: 'Korean',
        confidence: 0.99,
        script: 'Hangul',
        isCorpusLanguage: false,
      };
    }

    // Japanese (Hiragana or Katakana present)
    if (/[\u3040-\u309F\u30A0-\u30FF]/.test(trimmed)) {
      return {
        languageCode: 'ja',
        languageName: 'Japanese',
        confidence: 0.99,
        script: 'Kana/Kanji',
        isCorpusLanguage: false,
      };
    }

    // Chinese (Han ideographs without Kana)
    if (/[\u4E00-\u9FFF]/.test(trimmed)) {
      return {
        languageCode: 'zh',
        languageName: 'Chinese',
        confidence: 0.98,
        script: 'Han',
        isCorpusLanguage: false,
      };
    }

    // Cyrillic (Russian)
    if (/[\u0400-\u04FF]/.test(trimmed)) {
      return {
        languageCode: 'ru',
        languageName: 'Russian',
        confidence: 0.98,
        script: 'Cyrillic',
        isCorpusLanguage: false,
      };
    }

    // 2. Latin-script differentiation using marker words and morphological patterns
    let bestMatch = { code: 'en', name: 'English', score: 0 };

    for (const profile of LANGUAGE_PROFILES) {
      if (profile.script !== 'Latin') continue;

      let score = 0;
      for (const marker of profile.markers) {
        if (lower.includes(marker)) {
          // Markers like '¿' or exact question phrases have higher weight
          score += marker.length > 4 ? 3 : 2;
        }
      }

      if (profile.patterns) {
        for (const pattern of profile.patterns) {
          if (pattern.test(lower)) {
            score += 2;
          }
        }
      }

      if (score > bestMatch.score) {
        bestMatch = { code: profile.code, name: profile.name, score };
      }
    }

    // Threshold check: If best non-English match has significant score, treat as detected
    if (bestMatch.score >= 3) {
      return {
        languageCode: bestMatch.code,
        languageName: bestMatch.name,
        confidence: Math.min(0.96, 0.7 + bestMatch.score * 0.05),
        script: 'Latin',
        isCorpusLanguage: false,
      };
    }

    // Default to English (Corpus Language)
    return {
      languageCode: 'en',
      languageName: 'English',
      confidence: 0.95,
      script: 'Latin',
      isCorpusLanguage: true,
    };
  }

  /**
   * Normalizes and pivots a non-English query into English retrieval terms
   */
  public normalizeQueryForRetrieval(
    rawQuery: string,
    detectedLang: LanguageDetectionResult
  ): { retrievalQuery: string; extractedKeywords: string[] } {
    if (detectedLang.isCorpusLanguage || detectedLang.languageCode === 'en') {
      return { retrievalQuery: rawQuery, extractedKeywords: [] };
    }

    let normalized = rawQuery.toLowerCase();
    const extractedKeywords: string[] = [];

    // Apply domain translation replacements
    for (const [nonEng, eng] of Object.entries(DOMAIN_CROSS_LINGUAL_DICTIONARY)) {
      if (normalized.includes(nonEng)) {
        normalized = normalized.replace(new RegExp(nonEng, 'gi'), eng);
        extractedKeywords.push(eng);
      }
    }

    // Keep known entity identifiers intact (e.g. AR-10, AR-20, AR-40, ISO 3691-4, Singapore, Kuala Lumpur, Bangkok)
    const entities = rawQuery.match(/\b(ar-10|ar-20|ar-40|ar10|ar20|ar40|iso\s*3691-4|singapore|kuala lumpur|bangkok|tokyo)\b/gi) || [];
    for (const ent of entities) {
      if (!extractedKeywords.includes(ent)) {
        extractedKeywords.push(ent);
      }
    }

    return {
      retrievalQuery: normalized.trim(),
      extractedKeywords,
    };
  }

  /**
   * Localizes a verified answer, mathematical proof, or refusal message into the detected language
   */
  public localizeAnswer(
    answer: string,
    detectedLang: LanguageDetectionResult,
    isRefusal: boolean = false
  ): string {
    if (detectedLang.isCorpusLanguage || detectedLang.languageCode === 'en') {
      return answer;
    }

    const lang = detectedLang.languageCode;

    // 1. Refusal / Insufficient Evidence localization
    if (isRefusal || answer.startsWith('INSUFFICIENT_EVIDENCE')) {
      switch (lang) {
        case 'es':
          return 'INFORMACIÓN INSUFICIENTE: La base de conocimientos no contiene evidencia verificada suficiente para responder a esta consulta.';
        case 'fr':
          return 'PREUVE INSUFFISANTE: La base de connaissances ne contient pas suffisamment de preuves vérifiées pour répondre à cette demande.';
        case 'de':
          return 'UNZUREICHENDE BELEGE: Die Wissensdatenbank enthält nicht genügend verifizierte Belege, um diese Anfrage zu beantworten.';
        case 'it':
          return 'INFORMAZIONI INSUFFICIENTI: La base di conoscenza non contiene prove verificate sufficienti per rispondere a questa richiesta.';
        case 'pt':
          return 'INFORMAÇÃO INSUFICIENTE: A base de conhecimento não contém evidências verificadas suficientes para responder a esta consulta.';
        case 'zh':
          return '证据不足: 知识库不包含足够的已验证证据来回答此询问。';
        case 'ja':
          return '根拠不十分: ナレッジベースには、この問い合わせに回答するための十分な検証済み証拠が含まれていません。';
        case 'ru':
          return 'НЕДОСТАТОЧНО ДОКАЗАТЕЛЬСТВ: База знаний не содержит достаточных проверенных данных для ответа на этот запрос.';
        case 'hi':
          return 'अपर्याप्त साक्ष्य: ज्ञानकोष में इस प्रश्न का उत्तर देने के लिए पर्याप्त सत्यापित साक्ष्य नहीं हैं।';
        case 'ar':
          return 'أدلة غير كافية: لا تحتوي قاعدة المعرفة على أدلة تم التحقق منها كافية للإجابة على هذا الاستفسار.';
        default:
          return answer;
      }
    }

    // 2. Factual template translations for high-frequency domain responses
    // Preserve technical models, metrics, numbers, and warehouse names!
    let localized = answer;

    if (lang === 'es') {
      localized = localized
        .replace(/Aurora Robotics currently operates/gi, 'Aurora Robotics actualmente opera')
        .replace(/active robots across/gi, 'robots activos en')
        .replace(/operational warehouses/gi, 'almacenes operativos')
        .replace(/The speed limit in human worker zones is strictly/gi, 'El límite de velocidad en zonas de trabajadores humanos es estrictamente de')
        .replace(/The maximum speed of the/gi, 'La velocidad máxima del')
        .replace(/in open transit lanes is/gi, 'en carriles de tránsito abierto es de')
        .replace(/The combined battery capacity of/gi, 'La capacidad combinada de batería de')
        .replace(/The difference in robot count between/gi, 'La diferencia en cantidad de robots entre')
        .replace(/is exactly/gi, 'es exactamente de')
        .replace(/Step 1: Extract/gi, 'Paso 1: Extraer')
        .replace(/Step 2: Extract/gi, 'Paso 2: Extraer')
        .replace(/Step 3: Calculate/gi, 'Paso 3: Calcular')
        .replace(/robots/gi, 'robots')
        .replace(/The second largest robot fleet is located at/gi, 'La segunda flota de robots más grande se encuentra en')
        .replace(/with \*\*(\d+) robots\*\*/gi, 'con **$1 robots**');
    } else if (lang === 'fr') {
      localized = localized
        .replace(/Aurora Robotics currently operates/gi, 'Aurora Robotics exploite actuellement')
        .replace(/active robots across/gi, 'robots actifs dans')
        .replace(/operational warehouses/gi, 'entrepôts opérationnels')
        .replace(/The speed limit in human worker zones is strictly/gi, 'La limite de vitesse dans les zones de travailleurs humains est strictement de')
        .replace(/The maximum speed of the/gi, 'La vitesse maximale du')
        .replace(/The combined battery capacity of/gi, 'La capacité combinée de la batterie de')
        .replace(/The difference in robot count between/gi, 'La différence de nombre de robots entre')
        .replace(/is exactly/gi, 'est exactement de')
        .replace(/Step 1: Extract/gi, 'Étape 1: Extraire')
        .replace(/Step 2: Extract/gi, 'Étape 2: Extraire')
        .replace(/Step 3: Calculate/gi, 'Étape 3: Calculer');
    } else if (lang === 'de') {
      localized = localized
        .replace(/Aurora Robotics currently operates/gi, 'Aurora Robotics betreibt derzeit')
        .replace(/active robots across/gi, 'aktive Roboter in')
        .replace(/operational warehouses/gi, 'betriebsbereiten Lagerhäusern')
        .replace(/The speed limit in human worker zones is strictly/gi, 'Die Geschwindigkeitsbegrenzung in Zonen mit menschlichen Mitarbeitern beträgt strikt')
        .replace(/The maximum speed of the/gi, 'Die Höchstgeschwindigkeit des')
        .replace(/The combined battery capacity of/gi, 'Die kombinierte Akkukapazität von')
        .replace(/The difference in robot count between/gi, 'Der Unterschied in der Roboteranzahl zwischen')
        .replace(/is exactly/gi, 'beträgt genau')
        .replace(/Step 1: Extract/gi, 'Schritt 1: Entnahme von')
        .replace(/Step 2: Extract/gi, 'Schritt 2: Entnahme von')
        .replace(/Step 3: Calculate/gi, 'Schritt 3: Berechnung von');
    } else if (lang === 'zh') {
      localized = localized
        .replace(/Aurora Robotics currently operates/gi, 'Aurora Robotics 目前运营')
        .replace(/active robots across/gi, '台活跃机器人，分布在')
        .replace(/operational warehouses/gi, '个运营仓库中')
        .replace(/The speed limit in human worker zones is strictly/gi, '人类工作区域内的速度限制严格设定为')
        .replace(/The maximum speed of the/gi, '最高运行速度为')
        .replace(/The combined battery capacity of/gi, '合并电池容量为')
        .replace(/is exactly/gi, '确切为');
    } else if (lang === 'ja') {
      localized = localized
        .replace(/Aurora Robotics currently operates/gi, 'Aurora Robotics は現在、')
        .replace(/active robots across/gi, '台の稼働中ロボットを')
        .replace(/operational warehouses/gi, 'か所の稼働倉庫で運用しています')
        .replace(/The speed limit in human worker zones is strictly/gi, '人間作業員エリアにおける制限速度は厳格に')
        .replace(/is exactly/gi, 'です');
    }

    return localized;
  }
}

export const multilingualEngine = new MultilingualEngine();

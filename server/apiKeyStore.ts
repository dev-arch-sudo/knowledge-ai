import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { ApiKey, ApiUsage, ApiUsageStats } from '../src/types.js';

const DATA_DIR = path.join(process.cwd(), 'data');
const KEYS_FILE = path.join(DATA_DIR, 'api_keys.json');
const USAGE_FILE = path.join(DATA_DIR, 'api_usage.json');

// Rate limiting in-memory bucket: keyId -> timestamps[]
const rateLimitBuckets = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 100; // 100 req/min

export class ApiKeyStore {
  private keys: Map<string, ApiKey> = new Map();
  private usages: ApiUsage[] = [];
  private defaultTestRawKey: string | null = null;

  constructor() {
    this.loadFromDisk();
  }

  private loadFromDisk(): void {
    try {
      if (fs.existsSync(KEYS_FILE)) {
        const raw = fs.readFileSync(KEYS_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          for (const k of parsed) {
            this.keys.set(k.id, k);
          }
        }
      }
    } catch (err) {
      console.warn('Could not load api keys from disk:', err);
    }

    try {
      if (fs.existsSync(USAGE_FILE)) {
        const raw = fs.readFileSync(USAGE_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.usages = parsed;
        }
      }
    } catch (err) {
      console.warn('Could not load api usage from disk:', err);
    }

    // If no keys exist, initialize a default starter key for acc_default
    if (this.keys.size === 0) {
      const defaultRawSecret = 'kn_live_' + crypto.randomBytes(16).toString('hex');
      this.defaultTestRawKey = defaultRawSecret;
      const keyHash = this.hashKey(defaultRawSecret);
      const lastFour = defaultRawSecret.slice(-4);
      const masked = `kn_live_••••••••••••${lastFour}`;

      const starterKey: ApiKey = {
        id: 'key_starter_prod',
        accountId: 'acc_default',
        name: 'Default Production Backend',
        keyPrefix: 'kn_live_',
        keyHash,
        maskedKey: masked,
        environment: 'live',
        scopes: ['chat:read', 'ai:read', 'knowledge:read'],
        status: 'active',
        createdAt: Date.now(),
        lastUsedAt: null,
        expiresAt: null,
      };

      this.keys.set(starterKey.id, starterKey);

      // Also create a test environment key
      const testSecret = 'kn_test_' + crypto.randomBytes(16).toString('hex');
      const testHash = this.hashKey(testSecret);
      const testStarter: ApiKey = {
        id: 'key_starter_test',
        accountId: 'acc_default',
        name: 'Default Test Playground Key',
        keyPrefix: 'kn_test_',
        keyHash: testHash,
        maskedKey: `kn_test_••••••••••••${testSecret.slice(-4)}`,
        environment: 'test',
        scopes: ['chat:read', 'ai:read', 'knowledge:read'],
        status: 'active',
        createdAt: Date.now(),
        lastUsedAt: null,
        expiresAt: null,
      };
      this.keys.set(testStarter.id, testStarter);

      this.saveKeysToDisk();
    }
  }

  public hashKey(rawKey: string): string {
    return crypto.createHash('sha256').update(rawKey.trim()).digest('hex');
  }

  private saveKeysToDisk(): void {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(KEYS_FILE, JSON.stringify(Array.from(this.keys.values()), null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to save API keys to disk:', err);
    }
  }

  private saveUsageToDisk(): void {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      // Save last 500 records
      const trimmed = this.usages.slice(0, 500);
      fs.writeFileSync(USAGE_FILE, JSON.stringify(trimmed, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to save API usage to disk:', err);
    }
  }

  /**
   * Create a new API key. The plain text secret is returned ONLY ONCE!
   * The database only stores the SHA-256 hash.
   */
  createApiKey(params: {
    name: string;
    accountId?: string;
    environment?: 'live' | 'test';
    scopes?: string[];
  }): { apiKey: ApiKey; secret: string } {
    const environment = params.environment || 'live';
    const prefix = environment === 'test' ? 'kn_test_' : 'kn_live_';
    const entropy = crypto.randomBytes(20).toString('hex');
    const secret = `${prefix}${entropy}`;
    const keyHash = this.hashKey(secret);
    const lastFour = secret.slice(-4);
    const maskedKey = `${prefix}••••••••••••${lastFour}`;

    const id = 'key_' + crypto.randomBytes(8).toString('hex');
    const apiKey: ApiKey = {
      id,
      accountId: params.accountId || 'acc_default',
      name: params.name.trim() || 'New API Key',
      keyPrefix: prefix,
      keyHash,
      maskedKey,
      environment,
      scopes: params.scopes && params.scopes.length > 0 ? params.scopes : ['chat:read', 'ai:read', 'knowledge:read'],
      status: 'active',
      createdAt: Date.now(),
      lastUsedAt: null,
      expiresAt: null,
    };

    this.keys.set(id, apiKey);
    this.saveKeysToDisk();

    return { apiKey, secret };
  }

  /**
   * List all API keys for an account (masked only).
   */
  listApiKeys(accountId: string = 'acc_default'): ApiKey[] {
    return Array.from(this.keys.values())
      .filter((k) => k.accountId === accountId)
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  /**
   * Get an API key by ID (masked).
   */
  getApiKeyById(id: string): ApiKey | undefined {
    return this.keys.get(id);
  }

  /**
   * Revoke an API key.
   */
  revokeApiKey(id: string, accountId: string = 'acc_default'): boolean {
    const key = this.keys.get(id);
    if (!key || key.accountId !== accountId) {
      return false;
    }
    key.status = 'revoked';
    this.saveKeysToDisk();
    return true;
  }

  /**
   * Validate incoming raw Bearer API key.
   * Hashes key and compares to stored keyHash.
   */
  validateApiKey(rawKey: string): { valid: boolean; apiKey?: ApiKey; error?: string } {
    if (!rawKey || typeof rawKey !== 'string' || !rawKey.trim()) {
      return { valid: false, error: 'API key is missing or empty' };
    }

    const cleanKey = rawKey.trim();
    if (!cleanKey.startsWith('kn_live_') && !cleanKey.startsWith('kn_test_')) {
      return { valid: false, error: 'Invalid API key format' };
    }

    const hash = this.hashKey(cleanKey);
    let matchedKey: ApiKey | undefined;

    for (const k of this.keys.values()) {
      if (k.keyHash === hash) {
        matchedKey = k;
        break;
      }
    }

    if (!matchedKey) {
      return { valid: false, error: 'Invalid API key' };
    }

    if (matchedKey.status === 'revoked') {
      return { valid: false, error: 'API key has been revoked' };
    }

    if (matchedKey.expiresAt && matchedKey.expiresAt < Date.now()) {
      return { valid: false, error: 'API key has expired' };
    }

    // Update last used timestamp
    matchedKey.lastUsedAt = Date.now();
    this.saveKeysToDisk();

    return { valid: true, apiKey: matchedKey };
  }

  /**
   * Check rate limits (100 req/min/key).
   */
  checkRateLimit(keyId: string, maxRequests: number = RATE_LIMIT_MAX_REQUESTS): {
    allowed: boolean;
    remaining: number;
    resetSeconds: number;
  } {
    const now = Date.now();
    let timestamps = rateLimitBuckets.get(keyId) || [];

    // Filter out timestamps outside window
    timestamps = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);

    if (timestamps.length >= maxRequests) {
      const oldest = timestamps[0];
      const resetSeconds = Math.max(1, Math.ceil((RATE_LIMIT_WINDOW_MS - (now - oldest)) / 1000));
      rateLimitBuckets.set(keyId, timestamps);
      return { allowed: false, remaining: 0, resetSeconds };
    }

    timestamps.push(now);
    rateLimitBuckets.set(keyId, timestamps);

    const remaining = maxRequests - timestamps.length;
    return { allowed: true, remaining, resetSeconds: 60 };
  }

  /**
   * Record API usage metrics.
   */
  recordUsage(usage: Omit<ApiUsage, 'id'>): ApiUsage {
    const id = 'usage_' + crypto.randomBytes(8).toString('hex');
    const record: ApiUsage = {
      id,
      ...usage,
    };
    this.usages.unshift(record);
    // Keep 1000 in memory
    if (this.usages.length > 1000) {
      this.usages = this.usages.slice(0, 1000);
    }
    this.saveUsageToDisk();
    return record;
  }

  /**
   * Get developer usage statistics.
   */
  getUsageStats(accountId: string = 'acc_default'): ApiUsageStats {
    const accountLogs = this.usages.filter((u) => u.accountId === accountId);
    const totalRequests = accountLogs.length;
    const successfulRequests = accountLogs.filter((u) => u.status >= 200 && u.status < 300).length;
    const refusedRequests = accountLogs.filter((u) => u.refused).length;
    const errorRequests = accountLogs.filter((u) => u.status >= 400).length;

    const totalLatency = accountLogs.reduce((acc, u) => acc + (u.latencyMs || 0), 0);
    const averageLatencyMs = totalRequests > 0 ? Math.round(totalLatency / totalRequests) : 0;

    return {
      totalRequests,
      successfulRequests,
      refusedRequests,
      errorRequests,
      averageLatencyMs,
      recentLogs: accountLogs.slice(0, 50),
    };
  }

  /**
   * Helper for tests or starter playground key
   */
  getDefaultStarterKey(): ApiKey | undefined {
    for (const k of this.keys.values()) {
      if (k.status === 'active') return k;
    }
    return undefined;
  }
}

export const apiKeyStore = new ApiKeyStore();

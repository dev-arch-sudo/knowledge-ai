/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import crypto from 'crypto';
import { ApiKey, ApiKeyCreationResult, ApiKeyStatus } from './phase9Types.js';

export interface IdempotencyRecord {
  idempotencyKey: string;
  tenantId: string;
  endpoint: string;
  response: any;
  createdAt: number;
}

export interface RateLimitCheckResult {
  allowed: boolean;
  currentCount: number;
  maxLimit: number;
  resetTimeMs: number;
  retryAfterSeconds?: number;
}

export class ApiManagementService {
  private apiKeys = new Map<string, ApiKey>(); // keyId -> ApiKey
  private keyHashIndex = new Map<string, string>(); // secretHash -> keyId
  private idempotencyStore = new Map<string, IdempotencyRecord>();
  private tenantRequestWindows = new Map<string, number[]>(); // tenantId -> timestamps
  private apiKeyRequestWindows = new Map<string, number[]>(); // keyId -> timestamps

  constructor() {
    this.seedDefaultApiKeys();
  }

  private seedDefaultApiKeys() {
    const now = Date.now();
    // Default Alpha Key
    this.createKeyDirect({
      keyId: 'key_alpha_prod_01',
      tenantId: 'tenant_alpha',
      name: 'Alpha Production Agent Key',
      prefix: 'sk_live_alp',
      secretHash: this.hashSecret('sk_live_alp_alpha_super_secret_token_123'),
      scopes: ['knowledge:read', 'knowledge:query', 'mediator:execute', 'telemetry:read'],
      status: 'ACTIVE',
      createdAt: now - 10 * 86400000,
      createdBy: 'user_alpha_owner',
    });

    // Default Beta Key
    this.createKeyDirect({
      keyId: 'key_beta_dev_01',
      tenantId: 'tenant_beta',
      name: 'Beta Sandbox Key',
      prefix: 'sk_live_bet',
      secretHash: this.hashSecret('sk_live_bet_beta_sandbox_secret_token_456'),
      scopes: ['knowledge:read', 'mediator:execute'],
      status: 'ACTIVE',
      createdAt: now - 5 * 86400000,
      createdBy: 'user_beta_owner',
    });
  }

  private createKeyDirect(key: ApiKey) {
    this.apiKeys.set(key.keyId, key);
    this.keyHashIndex.set(key.secretHash, key.keyId);
  }

  private hashSecret(secret: string): string {
    return crypto.createHash('sha256').update(secret.trim()).digest('hex');
  }

  // --- API KEY OPERATIONS ---

  public createApiKey(
    tenantId: string,
    name: string,
    scopes: string[],
    createdBy: string,
    expiresInDays?: number
  ): ApiKeyCreationResult {
    const keyId = `key_${crypto.randomBytes(6).toString('hex')}`;
    const rawSecretPart = crypto.randomBytes(24).toString('hex');
    const prefix = `sk_live_${rawSecretPart.substring(0, 6)}`;
    const plaintextSecret = `${prefix}_${rawSecretPart}`;
    const secretHash = this.hashSecret(plaintextSecret);
    const now = Date.now();

    const apiKey: ApiKey = {
      keyId,
      tenantId,
      name: name.trim() || 'API Key',
      prefix,
      secretHash,
      scopes: scopes && scopes.length > 0 ? scopes : ['knowledge:read'],
      status: 'ACTIVE',
      createdAt: now,
      expiresAt: expiresInDays ? now + expiresInDays * 86400000 : undefined,
      createdBy,
    };

    this.apiKeys.set(keyId, apiKey);
    this.keyHashIndex.set(secretHash, keyId);

    return {
      apiKey,
      plaintextSecret,
    };
  }

  public listApiKeys(tenantId: string): ApiKey[] {
    return Array.from(this.apiKeys.values())
      .filter((k) => k.tenantId === tenantId)
      .map((k) => {
        // Safe representation - never reveal hash or secret
        const { secretHash, ...safeKey } = k;
        return { ...safeKey, secretHash: '[REDACTED_HASH]' } as ApiKey;
      });
  }

  public getApiKey(keyId: string): ApiKey | undefined {
    const key = this.apiKeys.get(keyId);
    if (!key) return undefined;
    const { secretHash, ...safeKey } = key;
    return { ...safeKey, secretHash: '[REDACTED_HASH]' } as ApiKey;
  }

  public verifyApiKey(plaintextSecret: string): {
    valid: boolean;
    apiKey?: ApiKey;
    tenantId?: string;
    scopes?: string[];
    errorReason?: string;
  } {
    if (!plaintextSecret || typeof plaintextSecret !== 'string') {
      return { valid: false, errorReason: 'Missing API key' };
    }

    const hash = this.hashSecret(plaintextSecret);
    const keyId = this.keyHashIndex.get(hash);
    if (!keyId) {
      return { valid: false, errorReason: 'Invalid API key' };
    }

    const key = this.apiKeys.get(keyId);
    if (!key) {
      return { valid: false, errorReason: 'API key record not found' };
    }

    if (key.status === 'REVOKED') {
      return { valid: false, errorReason: 'API key has been revoked' };
    }

    if (key.expiresAt && Date.now() > key.expiresAt) {
      key.status = 'EXPIRED';
      return { valid: false, errorReason: 'API key has expired' };
    }

    // Update lastUsedAt
    key.lastUsedAt = Date.now();
    this.apiKeys.set(keyId, key);

    return {
      valid: true,
      apiKey: key,
      tenantId: key.tenantId,
      scopes: key.scopes,
    };
  }

  public generateApiKey(
    tenantId: string,
    params: {
      name?: string;
      scopes?: string[];
      rateLimitPerMinute?: number;
      monthlyQuota?: number;
    }
  ): ApiKeyCreationResult {
    return this.createApiKey(
      tenantId,
      params.name || 'API Key',
      params.scopes || ['knowledge:read', 'mediator:execute', 'telemetry:read'],
      'tenant_admin'
    );
  }

  public revokeApiKey(keyId: string, tenantId: string, reason?: string): boolean {
    const key = this.apiKeys.get(keyId);
    if (!key || key.tenantId !== tenantId) {
      throw new Error(`API key ${keyId} not found for tenant ${tenantId}`);
    }

    key.status = 'REVOKED';
    this.apiKeys.set(keyId, key);
    // Remove from active lookup index so verification fails immediately
    this.keyHashIndex.delete(key.secretHash);
    return true;
  }

  public rotateApiKey(
    oldKeyId: string,
    tenantId: string,
    createdBy: string,
    gracePeriodHours: number = 24
  ): ApiKeyCreationResult {
    const oldKey = this.apiKeys.get(oldKeyId);
    if (!oldKey || oldKey.tenantId !== tenantId) {
      throw new Error(`API key ${oldKeyId} not found for tenant ${tenantId}`);
    }

    // 1. Create new key with same name & scopes
    const newKeyResult = this.createApiKey(
      tenantId,
      `${oldKey.name} (Rotated)`,
      [...oldKey.scopes],
      createdBy
    );

    // 2. Mark old key as ROTATING with grace period expiration
    oldKey.status = 'ROTATING';
    oldKey.expiresAt = Date.now() + gracePeriodHours * 3600000;
    oldKey.rotatedKeyId = newKeyResult.apiKey.keyId;
    this.apiKeys.set(oldKeyId, oldKey);

    return newKeyResult;
  }

  // --- IDEMPOTENCY ---

  public getCachedIdempotentResponse(
    tenantId: string,
    idempotencyKey: string,
    endpoint: string
  ): any | null {
    const composite = `${tenantId}:${endpoint}:${idempotencyKey}`;
    const record = this.idempotencyStore.get(composite);
    if (!record) return null;

    // Cache valid for 24 hours
    if (Date.now() - record.createdAt > 86400000) {
      this.idempotencyStore.delete(composite);
      return null;
    }

    return record.response;
  }

  public storeIdempotentResponse(
    tenantId: string,
    idempotencyKey: string,
    endpoint: string,
    response: any
  ): void {
    const composite = `${tenantId}:${endpoint}:${idempotencyKey}`;
    this.idempotencyStore.set(composite, {
      idempotencyKey,
      tenantId,
      endpoint,
      response,
      createdAt: Date.now(),
    });
  }

  // --- RATE LIMITING ---

  public checkRateLimit(
    entityId: string, // tenantId or keyId
    maxRequestsPerMin: number,
    isApiKey: boolean = false
  ): RateLimitCheckResult {
    const now = Date.now();
    const windowStart = now - 60000;
    const store = isApiKey ? this.apiKeyRequestWindows : this.tenantRequestWindows;

    let timestamps = store.get(entityId) || [];
    // Prune entries older than 1 minute
    timestamps = timestamps.filter((t) => t > windowStart);

    if (timestamps.length >= maxRequestsPerMin) {
      const oldest = timestamps[0];
      const resetTimeMs = oldest + 60000;
      const retryAfterSeconds = Math.max(1, Math.ceil((resetTimeMs - now) / 1000));
      return {
        allowed: false,
        currentCount: timestamps.length,
        maxLimit: maxRequestsPerMin,
        resetTimeMs,
        retryAfterSeconds,
      };
    }

    // Record this request
    timestamps.push(now);
    store.set(entityId, timestamps);

    return {
      allowed: true,
      currentCount: timestamps.length,
      maxLimit: maxRequestsPerMin,
      resetTimeMs: now + 60000,
    };
  }

  public getOpenApiSpec(): any {
    return {
      openapi: '3.1.0',
      info: {
        title: 'Mediator Multi-Tenant AI Gateway & SaaS Platform API',
        version: '9.0.0',
        description: 'Comprehensive enterprise API for Multi-Tenancy, Grounding, Memory, and AI Orchestration.',
      },
      servers: [{ url: '/api/v1', description: 'Production API Gateway' }],
      paths: {
        '/tenants': {
          get: { summary: 'List tenants' },
          post: { summary: 'Provision tenant' },
        },
        '/tenants/{tenantId}': {
          get: { summary: 'Get tenant details' },
        },
        '/tenants/{tenantId}/api-keys': {
          get: { summary: 'List API keys' },
          post: { summary: 'Generate API key' },
        },
        '/tenants/{tenantId}/quotas': {
          get: { summary: 'Get quota usage and limits' },
        },
        '/tenants/{tenantId}/billing': {
          get: { summary: 'Get billing account and plan' },
        },
        '/tenants/{tenantId}/webhooks': {
          get: { summary: 'List webhook subscriptions' },
          post: { summary: 'Register webhook endpoint' },
        },
        '/saas/status': {
          get: { summary: 'Check SaaS readiness gate report' },
        },
      },
    };
  }
}

export const apiManagementService = new ApiManagementService();

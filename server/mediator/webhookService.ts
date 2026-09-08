/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import crypto from 'crypto';
import {
  WebhookEndpoint,
  WebhookEvent,
  WebhookDelivery,
} from './phase9Types.js';

export class WebhookService {
  private endpoints = new Map<string, WebhookEndpoint>();
  private events: WebhookEvent[] = [];
  private deliveries: WebhookDelivery[] = [];
  private processedEventIds = new Set<string>();

  constructor() {
    this.seedDefaultEndpoints();
  }

  private seedDefaultEndpoints() {
    const now = Date.now();
    const endpointId = 'wh_ep_alpha_01';
    const secret = 'whsec_alpha_webhook_secret_key_789';
    const secretHash = crypto.createHash('sha256').update(secret).digest('hex');

    this.endpoints.set(endpointId, {
      endpointId,
      tenantId: 'tenant_alpha',
      url: 'https://api.alpha-aerospace.corp/webhooks/mediator',
      events: ['task.completed', 'evaluation.completed', 'quota.threshold'],
      secretHash,
      status: 'ACTIVE',
      createdAt: now - 5 * 86400000,
      failureCount: 0,
    });
  }

  // --- ENDPOINTS ---

  public createEndpoint(
    tenantId: string,
    url: string,
    events: string[],
    rawSecret?: string
  ): { endpoint: WebhookEndpoint; secret: string } {
    // SSRF / URL validation
    if (!url || !url.startsWith('https://')) {
      throw new Error('Webhook URL must use secure HTTPS protocol');
    }

    const endpointId = `wh_ep_${crypto.randomBytes(6).toString('hex')}`;
    const secret = rawSecret || `whsec_${crypto.randomBytes(24).toString('hex')}`;
    const secretHash = crypto.createHash('sha256').update(secret).digest('hex');

    const endpoint: WebhookEndpoint = {
      endpointId,
      tenantId,
      url,
      events: events && events.length > 0 ? events : ['task.completed'],
      secretHash,
      status: 'ACTIVE',
      createdAt: Date.now(),
      failureCount: 0,
    };

    this.endpoints.set(endpointId, endpoint);
    return { endpoint, secret };
  }

  public listEndpoints(tenantId: string): WebhookEndpoint[] {
    return Array.from(this.endpoints.values())
      .filter((e) => e.tenantId === tenantId)
      .map((e) => ({ ...e, secretHash: '[REDACTED_SECRET]' }));
  }

  public listWebhooks(tenantId: string): WebhookEndpoint[] {
    return this.listEndpoints(tenantId);
  }

  public registerWebhook(
    tenantId: string,
    params: { targetUrl: string; events: string[]; secret?: string }
  ): { endpoint: WebhookEndpoint; secret: string } {
    return this.createEndpoint(tenantId, params.targetUrl, params.events, params.secret);
  }

  public getDeliveryEvents(tenantId: string): WebhookDelivery[] {
    return this.listDeliveries(tenantId);
  }

  // --- EVENT EMISSION & DISPATCH ---

  public emitEvent(
    tenantId: string,
    category: string,
    payload: Record<string, any>
  ): { event: WebhookEvent; deliveries: WebhookDelivery[] } {
    const eventId = `evt_${crypto.randomBytes(8).toString('hex')}`;
    const now = Date.now();

    const event: WebhookEvent = {
      eventId,
      tenantId,
      category,
      payload,
      timestamp: now,
    };
    this.events.push(event);
    this.processedEventIds.add(eventId);

    const matchingEndpoints = Array.from(this.endpoints.values()).filter(
      (e) => e.tenantId === tenantId && e.status === 'ACTIVE' && (e.events.includes(category) || e.events.includes('*'))
    );

    const eventDeliveries: WebhookDelivery[] = [];

    for (const ep of matchingEndpoints) {
      const deliveryId = `del_${crypto.randomBytes(6).toString('hex')}`;
      // In-process delivery simulation: successful HTTP 200 simulation
      const delivery: WebhookDelivery = {
        deliveryId,
        eventId,
        endpointId: ep.endpointId,
        tenantId,
        attempt: 1,
        maxRetries: 3,
        status: 'SUCCESS',
        httpStatus: 200,
        timestamp: now,
        durationMs: Math.floor(Math.random() * 20) + 10,
      };
      this.deliveries.push(delivery);
      eventDeliveries.push(delivery);
    }

    return { event, deliveries: eventDeliveries };
  }

  public listDeliveries(tenantId: string, limit: number = 50): WebhookDelivery[] {
    return this.deliveries
      .filter((d) => d.tenantId === tenantId)
      .slice(-limit)
      .reverse();
  }

  // --- CRYPTOGRAPHIC SIGNATURE & REPLAY PROTECTION ---

  public computeSignature(payloadString: string, secret: string, timestamp: number): string {
    const signaturePayload = `${timestamp}.${payloadString}`;
    return crypto.createHmac('sha256', secret).update(signaturePayload).digest('hex');
  }

  public verifySignature(
    payloadString: string,
    signatureHeader: string,
    secret: string,
    toleranceMs: number = 300000 // 5 minutes tolerance
  ): { valid: boolean; reason?: string } {
    // Header format: t=1234567890,v1=abcdef...
    const parts = signatureHeader.split(',');
    let timestampStr = '';
    let v1Sig = '';

    for (const p of parts) {
      if (p.startsWith('t=')) timestampStr = p.substring(2);
      if (p.startsWith('v1=')) v1Sig = p.substring(3);
    }

    if (!timestampStr || !v1Sig) {
      return { valid: false, reason: 'Malformed signature header: missing t or v1' };
    }

    const timestamp = parseInt(timestampStr, 10);
    const now = Date.now();
    if (Math.abs(now - timestamp) > toleranceMs) {
      return { valid: false, reason: 'Signature timestamp outside tolerance (replay protection)' };
    }

    const expectedSig = this.computeSignature(payloadString, secret, timestamp);
    const bufA = Buffer.from(v1Sig, 'utf-8');
    const bufB = Buffer.from(expectedSig, 'utf-8');

    if (bufA.length !== bufB.length) {
      return { valid: false, reason: 'Signature mismatch' };
    }

    const isValid = crypto.timingSafeEqual(bufA, bufB);

    return isValid ? { valid: true } : { valid: false, reason: 'Signature mismatch' };
  }

  public isDuplicateEvent(eventId: string): boolean {
    return this.processedEventIds.has(eventId);
  }
}

export const webhookService = new WebhookService();

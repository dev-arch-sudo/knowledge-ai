/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import crypto from 'crypto';
import {
  Tenant,
  TenantStatus,
  TenantRole,
  TenantMembership,
  MembershipStatus,
  TenantInvitation,
  OwnershipTransfer,
  Permission,
  AuthenticatedPrincipal,
  SecurityContext,
} from './phase9Types.js';

// Predefined Role-to-Permissions Mapping
export const ROLE_PERMISSIONS: Record<TenantRole, Permission[]> = {
  OWNER: [
    'knowledge.read',
    'knowledge.write',
    'knowledge.publish',
    'memory.read',
    'memory.manage',
    'mediator.execute',
    'mediator.configure',
    'provider.manage',
    'evaluation.run',
    'evaluation.review',
    'telemetry.read',
    'billing.read',
    'billing.manage',
    'members.manage',
    'apiKeys.create',
    'apiKeys.revoke',
    'configuration.manage',
    'security.audit',
  ],
  ADMIN: [
    'knowledge.read',
    'knowledge.write',
    'knowledge.publish',
    'memory.read',
    'memory.manage',
    'mediator.execute',
    'mediator.configure',
    'provider.manage',
    'evaluation.run',
    'evaluation.review',
    'telemetry.read',
    'billing.read',
    'members.manage',
    'apiKeys.create',
    'apiKeys.revoke',
    'configuration.manage',
    'security.audit',
  ],
  DEVELOPER: [
    'knowledge.read',
    'knowledge.write',
    'memory.read',
    'mediator.execute',
    'mediator.configure',
    'provider.manage',
    'evaluation.run',
    'evaluation.review',
    'telemetry.read',
    'apiKeys.create',
    'apiKeys.revoke',
  ],
  OPERATOR: [
    'knowledge.read',
    'mediator.execute',
    'evaluation.run',
    'telemetry.read',
    'security.audit',
  ],
  ANALYST: [
    'knowledge.read',
    'memory.read',
    'evaluation.review',
    'telemetry.read',
    'billing.read',
  ],
  MEMBER: [
    'knowledge.read',
    'memory.read',
    'mediator.execute',
  ],
  VIEWER: [
    'knowledge.read',
    'memory.read',
    'telemetry.read',
  ],
};

export class MultiTenancyService {
  private tenants = new Map<string, Tenant>();
  private memberships = new Map<string, TenantMembership>();
  private invitations = new Map<string, TenantInvitation>();
  private ownershipTransfers = new Map<string, OwnershipTransfer>();

  constructor() {
    this.seedDefaultTenants();
  }

  private seedDefaultTenants() {
    const now = Date.now();

    // Tenant Alpha (Primary Production Tenant)
    const tAlpha: Tenant = {
      tenantId: 'tenant_alpha',
      name: 'Alpha Aerospace Systems',
      status: 'ACTIVE',
      planId: 'PRO',
      createdAt: now - 30 * 86400000,
      updatedAt: now - 86400000,
      configurationVersion: 2,
    };
    this.tenants.set(tAlpha.tenantId, tAlpha);

    // Tenant Beta (Secondary Development Tenant)
    const tBeta: Tenant = {
      tenantId: 'tenant_beta',
      name: 'Beta Robotics Laboratory',
      status: 'ACTIVE',
      planId: 'STARTER',
      createdAt: now - 14 * 86400000,
      updatedAt: now - 43200000,
      configurationVersion: 1,
    };
    this.tenants.set(tBeta.tenantId, tBeta);

    // Tenant Gamma (Suspended Tenant)
    const tGamma: Tenant = {
      tenantId: 'tenant_gamma',
      name: 'Gamma Inactive Partner',
      status: 'SUSPENDED',
      planId: 'FREE',
      createdAt: now - 60 * 86400000,
      updatedAt: now - 10 * 86400000,
      configurationVersion: 1,
    };
    this.tenants.set(tGamma.tenantId, tGamma);

    // Seed Memberships
    // Alpha Owner
    this.addMembershipDirect({
      membershipId: 'mem_alpha_owner',
      tenantId: 'tenant_alpha',
      userId: 'user_alpha_owner',
      role: 'OWNER',
      status: 'ACTIVE',
      createdAt: now - 30 * 86400000,
      updatedAt: now - 30 * 86400000,
    });
    // Alpha Dev
    this.addMembershipDirect({
      membershipId: 'mem_alpha_dev',
      tenantId: 'tenant_alpha',
      userId: 'user_alpha_dev',
      role: 'DEVELOPER',
      status: 'ACTIVE',
      createdAt: now - 20 * 86400000,
      updatedAt: now - 20 * 86400000,
    });
    // Beta Owner
    this.addMembershipDirect({
      membershipId: 'mem_beta_owner',
      tenantId: 'tenant_beta',
      userId: 'user_beta_owner',
      role: 'OWNER',
      status: 'ACTIVE',
      createdAt: now - 14 * 86400000,
      updatedAt: now - 14 * 86400000,
    });
    // Gamma Owner
    this.addMembershipDirect({
      membershipId: 'mem_gamma_owner',
      tenantId: 'tenant_gamma',
      userId: 'user_gamma_owner',
      role: 'OWNER',
      status: 'ACTIVE',
      createdAt: now - 60 * 86400000,
      updatedAt: now - 60 * 86400000,
    });
  }

  private addMembershipDirect(mem: TenantMembership) {
    this.memberships.set(mem.membershipId, mem);
  }

  // --- TENANT LIFECYCLE ---

  public createTenant(name: string, planId: string = 'FREE', ownerUserId?: string): Tenant {
    const trimmed = name.trim();
    if (!trimmed) {
      throw new Error('Tenant name is required');
    }
    const tenantId = `tenant_${crypto.randomBytes(6).toString('hex')}`;
    const now = Date.now();
    const tenant: Tenant = {
      tenantId,
      name: trimmed,
      status: 'ACTIVE',
      planId,
      createdAt: now,
      updatedAt: now,
      configurationVersion: 1,
    };
    this.tenants.set(tenantId, tenant);

    if (ownerUserId) {
      const membershipId = `mem_${crypto.randomBytes(6).toString('hex')}`;
      this.memberships.set(membershipId, {
        membershipId,
        tenantId,
        userId: ownerUserId,
        role: 'OWNER',
        status: 'ACTIVE',
        createdAt: now,
        updatedAt: now,
      });
    }

    return tenant;
  }

  public provisionTenant(params: {
    name: string;
    tier?: string;
    ownerUserId?: string;
    contactEmail?: string;
    region?: string;
    allowedDomains?: string[];
  }): Tenant {
    return this.createTenant(params.name, params.tier || 'FREE', params.ownerUserId);
  }

  public getTenant(tenantId: string): Tenant | undefined {
    return this.tenants.get(tenantId);
  }

  public listTenants(): Tenant[] {
    return Array.from(this.tenants.values()).filter((t) => !t.isDeleted);
  }

  public updateTenantStatus(tenantId: string, status: TenantStatus, actorContext?: SecurityContext): Tenant {
    const tenant = this.tenants.get(tenantId);
    if (!tenant) {
      throw new Error(`Tenant ${tenantId} not found`);
    }

    if (tenant.status === status) {
      return { ...tenant };
    }

    // Valid state transitions
    const validTransitions: Record<TenantStatus, TenantStatus[]> = {
      PENDING: ['ACTIVE', 'DEACTIVATED'],
      ACTIVE: ['SUSPENDED', 'DEACTIVATED'],
      SUSPENDED: ['ACTIVE', 'DEACTIVATED'],
      DEACTIVATED: ['ACTIVE'], // reactivate requires admin
    };

    const allowed = validTransitions[tenant.status] || [];
    if (!allowed.includes(status)) {
      throw new Error(`Invalid tenant status transition from ${tenant.status} to ${status}`);
    }

    const updated: Tenant = {
      ...tenant,
      status,
      updatedAt: Date.now(),
    };
    this.tenants.set(tenantId, updated);
    return updated;
  }

  // --- SECURITY CONTEXT & ISOLATION RESOLUTION ---

  public resolveSecurityContext(
    principal: AuthenticatedPrincipal,
    requestedTenantId?: string
  ): SecurityContext {
    // 1. If platform admin with no specified tenant, they must select an explicit tenant
    const targetTenantId = requestedTenantId || Object.keys(principal.tenantMemberships)[0];
    if (!targetTenantId) {
      throw new Error('No tenant membership found for authenticated principal');
    }

    const tenant = this.tenants.get(targetTenantId);
    if (!tenant) {
      throw new Error(`Tenant ${targetTenantId} does not exist`);
    }

    if (tenant.status === 'DEACTIVATED') {
      throw new Error(`Tenant ${targetTenantId} is deactivated`);
    }

    // 2. Resolve membership & role
    let role: TenantRole = 'VIEWER';
    let status: MembershipStatus = 'ACTIVE';

    if (principal.isPlatformAdmin) {
      role = 'ADMIN';
    } else {
      const membership = principal.tenantMemberships[targetTenantId];
      if (!membership || membership.status !== 'ACTIVE') {
        throw new Error(`Principal ${principal.userId} has no active membership in tenant ${targetTenantId}`);
      }
      role = membership.role;
      status = membership.status;
    }

    const perms = new Set<Permission>(ROLE_PERMISSIONS[role] || []);

    return {
      authenticatedPrincipal: principal,
      effectiveTenantId: targetTenantId,
      effectiveRole: role,
      effectivePermissions: perms,
    };
  }

  public checkPermission(context: SecurityContext, permission: Permission): boolean {
    return context.effectivePermissions.has(permission);
  }

  public assertTenantAccess(context: SecurityContext, resourceTenantId: string): void {
    if (context.effectiveTenantId !== resourceTenantId) {
      throw new Error(
        `Cross-tenant access forbidden: effective tenant ${context.effectiveTenantId} cannot access resource belonging to ${resourceTenantId}`
      );
    }
  }

  // --- MEMBERSHIP & OWNER PROTECTION ---

  public listMemberships(tenantId: string): TenantMembership[] {
    return Array.from(this.memberships.values()).filter(
      (m) => m.tenantId === tenantId && m.status !== 'REMOVED'
    );
  }

  public getMembership(membershipId: string): TenantMembership | undefined {
    return this.memberships.get(membershipId);
  }

  public createMembership(
    tenantId: string,
    userId: string,
    role: TenantRole,
    actorContext: SecurityContext
  ): TenantMembership {
    this.assertTenantAccess(actorContext, tenantId);
    if (!actorContext.effectivePermissions.has('members.manage')) {
      throw new Error('Permission denied: members.manage required');
    }

    // Check if user already active in tenant
    const existing = Array.from(this.memberships.values()).find(
      (m) => m.tenantId === tenantId && m.userId === userId && m.status === 'ACTIVE'
    );
    if (existing) {
      throw new Error(`User ${userId} already has an active membership in tenant ${tenantId}`);
    }

    const now = Date.now();
    const membership: TenantMembership = {
      membershipId: `mem_${crypto.randomBytes(6).toString('hex')}`,
      tenantId,
      userId,
      role,
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    };
    this.memberships.set(membership.membershipId, membership);
    return membership;
  }

  public updateMembershipRole(
    membershipId: string,
    newRole: TenantRole,
    actorContext: SecurityContext
  ): TenantMembership {
    const mem = this.memberships.get(membershipId);
    if (!mem || mem.status === 'REMOVED') {
      throw new Error(`Membership ${membershipId} not found`);
    }
    this.assertTenantAccess(actorContext, mem.tenantId);

    if (!actorContext.effectivePermissions.has('members.manage')) {
      throw new Error('Permission denied: members.manage required');
    }

    // Owner protection: if changing from OWNER to something else, check if last owner
    if (mem.role === 'OWNER' && newRole !== 'OWNER') {
      this.protectLastOwner(mem.tenantId, mem.userId);
    }

    mem.role = newRole;
    mem.updatedAt = Date.now();
    this.memberships.set(membershipId, mem);
    return mem;
  }

  public removeMembership(membershipId: string, actorContext: SecurityContext): boolean {
    const mem = this.memberships.get(membershipId);
    if (!mem || mem.status === 'REMOVED') {
      throw new Error(`Membership ${membershipId} not found`);
    }
    this.assertTenantAccess(actorContext, mem.tenantId);

    if (!actorContext.effectivePermissions.has('members.manage')) {
      throw new Error('Permission denied: members.manage required');
    }

    // Owner protection
    if (mem.role === 'OWNER') {
      this.protectLastOwner(mem.tenantId, mem.userId);
    }

    mem.status = 'REMOVED';
    mem.updatedAt = Date.now();
    this.memberships.set(membershipId, mem);
    return true;
  }

  public protectLastOwner(tenantId: string, targetUserId: string): void {
    const activeOwners = Array.from(this.memberships.values()).filter(
      (m) => m.tenantId === tenantId && m.role === 'OWNER' && m.status === 'ACTIVE'
    );
    if (activeOwners.length <= 1 && activeOwners.some((o) => o.userId === targetUserId)) {
      throw new Error(
        `Cannot remove or demote the last remaining OWNER of tenant ${tenantId}. Use ownership transfer workflow first.`
      );
    }
  }

  // --- OWNERSHIP TRANSFER ---

  public requestOwnershipTransfer(
    tenantId: string,
    currentOwnerId: string,
    targetUserId: string
  ): OwnershipTransfer {
    const isOwner = Array.from(this.memberships.values()).some(
      (m) => m.tenantId === tenantId && m.userId === currentOwnerId && m.role === 'OWNER' && m.status === 'ACTIVE'
    );
    if (!isOwner) {
      throw new Error(`User ${currentOwnerId} is not an active OWNER of tenant ${tenantId}`);
    }

    // Check target exists as active member
    const targetMember = Array.from(this.memberships.values()).some(
      (m) => m.tenantId === tenantId && m.userId === targetUserId && m.status === 'ACTIVE'
    );
    if (!targetMember) {
      throw new Error(`Target user ${targetUserId} must be an active member of tenant ${tenantId}`);
    }

    const transferId = `trans_${crypto.randomBytes(6).toString('hex')}`;
    const now = Date.now();
    const transfer: OwnershipTransfer = {
      transferId,
      tenantId,
      currentOwnerId,
      targetUserId,
      status: 'PENDING_CONFIRMATION',
      createdAt: now,
      expiresAt: now + 7 * 86400000,
    };
    this.ownershipTransfers.set(transferId, transfer);
    return transfer;
  }

  public confirmOwnershipTransfer(transferId: string, targetUserId: string): OwnershipTransfer {
    const transfer = this.ownershipTransfers.get(transferId);
    if (!transfer) {
      throw new Error(`Transfer ${transferId} not found`);
    }
    if (transfer.status !== 'PENDING_CONFIRMATION') {
      throw new Error(`Transfer ${transferId} is not in PENDING_CONFIRMATION state`);
    }
    if (transfer.targetUserId !== targetUserId) {
      throw new Error(`User ${targetUserId} is not authorized to confirm this transfer`);
    }
    if (Date.now() > transfer.expiresAt) {
      transfer.status = 'EXPIRED';
      throw new Error(`Transfer ${transferId} has expired`);
    }

    // Apply ownership changes
    // 1. Promote target to OWNER
    const targetMem = Array.from(this.memberships.values()).find(
      (m) => m.tenantId === transfer.tenantId && m.userId === targetUserId && m.status === 'ACTIVE'
    );
    if (targetMem) {
      targetMem.role = 'OWNER';
      targetMem.updatedAt = Date.now();
    }

    // 2. Demote previous owner to ADMIN
    const prevOwnerMem = Array.from(this.memberships.values()).find(
      (m) => m.tenantId === transfer.tenantId && m.userId === transfer.currentOwnerId && m.status === 'ACTIVE'
    );
    if (prevOwnerMem) {
      prevOwnerMem.role = 'ADMIN';
      prevOwnerMem.updatedAt = Date.now();
    }

    const completedTransfer: OwnershipTransfer = {
      ...transfer,
      status: 'COMPLETED',
      completedAt: Date.now(),
    };
    this.ownershipTransfers.set(transferId, completedTransfer);
    return completedTransfer;
  }

  // --- INVITATIONS ---

  public createInvitation(
    tenantId: string,
    email: string,
    role: TenantRole,
    actorContext: SecurityContext
  ): { invitation: TenantInvitation; token: string } {
    this.assertTenantAccess(actorContext, tenantId);
    if (!actorContext.effectivePermissions.has('members.manage')) {
      throw new Error('Permission denied: members.manage required');
    }

    const emailHash = crypto.createHash('sha256').update(email.toLowerCase().trim()).digest('hex');
    const rawToken = crypto.randomBytes(24).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const invitationId = `inv_${crypto.randomBytes(6).toString('hex')}`;
    const now = Date.now();
    const invitation: TenantInvitation = {
      invitationId,
      tenantId,
      emailHash,
      role,
      status: 'PENDING',
      tokenHash,
      expiresAt: now + 7 * 86400000,
      createdAt: now,
    };
    this.invitations.set(invitationId, invitation);

    return { invitation, token: rawToken };
  }

  public acceptInvitation(invitationId: string, rawToken: string, userId: string): TenantMembership {
    const inv = this.invitations.get(invitationId);
    if (!inv || inv.status !== 'PENDING') {
      throw new Error(`Invitation ${invitationId} is invalid or expired`);
    }

    if (Date.now() > inv.expiresAt) {
      inv.status = 'EXPIRED';
      throw new Error(`Invitation ${invitationId} has expired`);
    }

    const expectedHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    if (expectedHash !== inv.tokenHash) {
      throw new Error('Invalid invitation token');
    }

    inv.status = 'ACCEPTED';

    // Create active membership
    const now = Date.now();
    const membership: TenantMembership = {
      membershipId: `mem_${crypto.randomBytes(6).toString('hex')}`,
      tenantId: inv.tenantId,
      userId,
      role: inv.role,
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    };
    this.memberships.set(membership.membershipId, membership);
    return membership;
  }
}

export const multiTenancyService = new MultiTenancyService();

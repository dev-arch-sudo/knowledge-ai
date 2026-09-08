/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { executeComprehensiveAudit } from '../server/fullAuditRunner.js';

async function main() {
  console.log('================================================================');
  console.log('STARTING FULL PRODUCTION-READINESS AND SECURITY AUDIT');
  console.log('================================================================');

  try {
    const report = await executeComprehensiveAudit();
    console.log('\n--- AUDIT RESULTS SUMMARY ---');
    console.log(`Execution Duration: ${report.executionDurationMs} ms`);
    console.log(`Cumulative Regression Tests: ${report.regressionSuites.cumulativePassed}/${report.regressionSuites.cumulativeTotal} passed`);
    console.log(`- Knowledge Phase 4: ${report.regressionSuites.knowledgePhase4.passed}/${report.regressionSuites.knowledgePhase4.total}`);
    console.log(`- Mediator Phase 3: ${report.regressionSuites.mediatorPhase3.passed}/${report.regressionSuites.mediatorPhase3.total}`);
    console.log(`- Mediator Phase 4: ${report.regressionSuites.mediatorPhase4.passed}/${report.regressionSuites.mediatorPhase4.total}`);
    console.log(`- Mediator Phase 5: ${report.regressionSuites.mediatorPhase5.passed}/${report.regressionSuites.mediatorPhase5.total}`);
    console.log(`- Mediator Phase 6: ${report.regressionSuites.mediatorPhase6.passed}/${report.regressionSuites.mediatorPhase6.total}`);
    console.log(`- Mediator Phase 7: ${report.regressionSuites.mediatorPhase7.passed}/${report.regressionSuites.mediatorPhase7.total}`);
    console.log(`- Mediator Phase 8: ${report.regressionSuites.mediatorPhase8.passed}/${report.regressionSuites.mediatorPhase8.total}`);
    console.log(`- Phase 9 SaaS Platform: ${report.regressionSuites.phase9SaaS.passed}/${report.regressionSuites.phase9SaaS.total}`);

    console.log('\n--- MULTI-TENANT ISOLATION ---');
    console.log(`Status: ${report.multiTenantIsolationTest.passed ? 'PASS' : 'FAIL'}`);
    for (const c of report.multiTenantIsolationTest.checks) {
      console.log(`  [${c.passed ? 'PASS' : 'FAIL'}] ${c.check}: ${c.details}`);
    }

    console.log('\n--- REAL AURORA ROBOTICS GROUNDING ---');
    console.log(`Status: ${report.auroraRoboticsGroundingTest.passed ? 'PASS' : 'FAIL'}`);
    for (const c of report.auroraRoboticsGroundingTest.checks) {
      console.log(`  Q: ${c.question}`);
      console.log(`  Expected: ${c.expected}`);
      console.log(`  Actual: ${c.actual.substring(0, 120)}...`);
      console.log(`  Result: ${c.passed ? 'PASS' : 'FAIL'}\n`);
    }

    console.log('--- ADVERSARIAL SECURITY ---');
    console.log(`Status: ${report.adversarialSecurityTest.passed ? 'PASS' : 'FAIL'}`);
    for (const c of report.adversarialSecurityTest.checks) {
      console.log(`  [${c.passed ? 'PASS' : 'FAIL'}] ${c.testName}: ${c.details}`);
    }

    console.log('\n--- AUDIT LEDGER CRYPTOGRAPHIC TAMPER TEST ---');
    console.log(`Status: ${report.auditLedgerTamperTest.passed ? 'PASS' : 'FAIL'}: ${report.auditLedgerTamperTest.details}`);

    console.log('\n--- WEBHOOK SECURITY TEST ---');
    console.log(`Status: ${report.webhookSecurityTest.passed ? 'PASS' : 'FAIL'}: ${report.webhookSecurityTest.details}`);

    console.log('\n--- PRODUCTION READINESS GATES ---');
    for (const [gate, info] of Object.entries(report.productionReadinessGates)) {
      console.log(`  ${gate.padEnd(24)}: [${info.status}] ${info.details}`);
    }

    console.log('\n================================================================');
    console.log(`OVERALL RECOMMENDATION: ${report.overallRecommendation}`);
    console.log('================================================================');

    if (
      report.regressionSuites.cumulativePassed === report.regressionSuites.cumulativeTotal &&
      report.multiTenantIsolationTest.passed &&
      report.auroraRoboticsGroundingTest.passed &&
      report.adversarialSecurityTest.passed
    ) {
      process.exit(0);
    } else {
      process.exit(1);
    }
  } catch (err: any) {
    console.error('Audit execution error:', err);
    process.exit(1);
  }
}

main();

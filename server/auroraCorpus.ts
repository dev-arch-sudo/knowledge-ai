/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Comprehensive Aurora Robotics Authoritative Corpus Generator
 * Implements "Knowledge AI Grounding Test Document.pdf" per Phase 9.5 Specification.
 */

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export async function generateFullAuroraRoboticsCorpusPdf(): Promise<{ filename: string; buffer: Buffer }> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);

  // Page 1: Operational Facilities & Warehouses Overview
  const p1 = doc.addPage([612, 792]);
  p1.drawText('Aurora Robotics Fleet & Operations Overview', { x: 50, y: 740, size: 18, font: boldFont, color: rgb(0.08, 0.18, 0.36) });
  p1.drawText('Official Operations & Technical Documentation — Document ID: AR-CORPUS-2026-V2', { x: 50, y: 720, size: 9, font, color: rgb(0.4, 0.4, 0.4) });
  p1.drawLine({ start: { x: 50, y: 710 }, end: { x: 562, y: 710 }, thickness: 1, color: rgb(0.8, 0.8, 0.8) });

  p1.drawText('Section 1: Active Fleet Architecture & Operational Warehouses', { x: 50, y: 685, size: 13, font: boldFont, color: rgb(0.1, 0.2, 0.3) });
  const p1Lines = [
    'Aurora Robotics currently operates 4 currently operational warehouses across the Asia-Pacific region.',
    'The 4 operational warehouse facilities are:',
    '1. Singapore Central Logistics Hub: currently houses 120 active robots.',
    '2. Singapore North Fulfillment Depot: currently houses 80 active robots.',
    '3. Kuala Lumpur Distribution Hub: currently houses 60 active robots.',
    '4. Bangkok Regional Transit Facility: currently houses 40 active robots.',
    '',
    'Across these 4 operational warehouses, Aurora Robotics operates 300 currently active robots in total.',
    'The fleet consists of three primary autonomous mobile robot models:',
    '- 150 AR-10 light-duty courier robots (representing 50.0% of the active fleet).',
    '- 100 AR-20 standard package handling units (representing 33.33% of the active fleet).',
    '- 50 AR-40 heavy-payload automated mobile transporters (representing 16.67% of the active fleet).',
    'There are exactly 100 more AR-10 robots (150) than AR-40 robots (50) currently active in the fleet.',
    'The combined robot count across Singapore Central (120) and Singapore North (80) is exactly 200 robots.',
    'The number of robots stationed in warehouse facilities outside of Singapore is exactly 100 robots (Kuala Lumpur 60 + Bangkok 40).',
    'The largest current warehouse by robot allocation is Singapore Central Logistics Hub with 120 robots.',
    'The warehouse facility with the second largest number of robots is Singapore North Fulfillment Depot with 80 robots.',
    'The difference in robot count between Singapore Central (120) and Kuala Lumpur (60) is exactly 60 robots.'
  ];
  let y1 = 660;
  for (const line of p1Lines) {
    p1.drawText(line, { x: 50, y: y1, size: 9.5, font: line.startsWith('Section') ? boldFont : font, color: rgb(0.15, 0.15, 0.15) });
    y1 -= 15;
  }

  // Page 2: Robot Technical Specifications & Performance Metrics
  const p2 = doc.addPage([612, 792]);
  p2.drawText('Section 2: Autonomous Mobile Robot Model Technical Specifications', { x: 50, y: 740, size: 13, font: boldFont, color: rgb(0.1, 0.2, 0.3) });
  p2.drawLine({ start: { x: 50, y: 725 }, end: { x: 562, y: 725 }, thickness: 1, color: rgb(0.8, 0.8, 0.8) });

  const p2Lines = [
    'Model Comparison & Physical Capacities:',
    '- AR-10: Payload capacity 10 kg, maximum speed 3.2 m/s, battery capacity 4.0 kWh, operating time 14 hours.',
    '- AR-20: Payload capacity 20 kg, maximum speed 2.8 m/s, battery capacity 8.0 kWh, operating time 13 hours.',
    '- AR-40: Engineered for heavy intra-facility transfer and palette transport.',
    '',
    'Detailed AR-40 Technical Specifications:',
    '- AR-40 payload capacity: 40 kg (the highest payload capacity in the fleet).',
    '- AR-40 maximum speed: 2.5 m/s under clear industrial operating corridors.',
    '- AR-40 battery capacity: 12.0 kWh lithium-iron-phosphate battery pack.',
    '- AR-40 operating time: approximately 12 hours of continuous duty on a full charge.',
    '- Average charging time: 75 minutes via automated floor docking contact plates.',
    '',
    'Operational Performance & Field Telemetry (August 2026):',
    '- August 2026 package movements: approximately 1.2 million package movements completed across all warehouses.',
    '- Delivery success rate: 98.4% successful automated package movements.',
    '- Manual intervention rate: 1.6% manual/retry rate requiring supervisor attention.',
    '- Average daily travel distance: 18 km/day average per active robot unit.'
  ];
  let y2 = 700;
  for (const line of p2Lines) {
    p2.drawText(line, { x: 50, y: y2, size: 9.5, font: line.includes('Specifications:') || line.includes('Telemetry') ? boldFont : font, color: rgb(0.15, 0.15, 0.15) });
    y2 -= 15;
  }

  // Page 3: Maintenance Protocols, Safety Regulations & System Architecture
  const p3 = doc.addPage([612, 792]);
  p3.drawText('Section 3: Maintenance Protocols, Safety Regulations & Core Services', { x: 50, y: 740, size: 13, font: boldFont, color: rgb(0.1, 0.2, 0.3) });
  p3.drawLine({ start: { x: 50, y: 725 }, end: { x: 562, y: 725 }, thickness: 1, color: rgb(0.8, 0.8, 0.8) });

  const p3Lines = [
    'Preventive Maintenance Protocols:',
    '- Maintenance interval: every 30 days mandatory scheduled inspection and sensor recalibration.',
    '- Inspection duration: 45-minute inspection required per unit by certified technicians.',
    '- Battery replacement policy: mandatory battery replacement below 70% health capacity.',
    '- Emergency mechanical dynamic braking stops any unit from full speed to 0 within 0.4 meters.',
    '',
    'Safety Regulations & Restricted Operating Speeds:',
    '- In designated human-worker zones, human-worker zone maximum speed is strictly 0.8 m/s enforced by lidar.',
    '- Collision detection policy: operators cannot disable collision detection under any circumstance.',
    '- Software change governance: Robotics Safety Team approval required for safety software changes.',
    '',
    'Centralized System Architecture & Service Hierarchy:',
    'The centralized robot operating system comprises three core real-time services:',
    '1. Navigation Service: calculates local path planning, obstacle avoidance, and dead reckoning.',
    '2. Fleet Coordination Service: manages fleet-wide mission assignment, corridor routing, and charging station slots.',
    '3. Safety Monitoring Service: continuously monitors onboard lidar, bumper switches, and human proximity.',
    '- Service Event Priority: Safety Monitoring has priority during safety events over Navigation and Fleet Coordination.'
  ];
  let y3 = 700;
  for (const line of p3Lines) {
    p3.drawText(line, { x: 50, y: y3, size: 9.5, font: line.includes('Protocols:') || line.includes('Regulations') || line.includes('Hierarchy:') ? boldFont : font, color: rgb(0.15, 0.15, 0.15) });
    y3 -= 15;
  }

  // Page 4: Strategic Roadmap & Unconfirmed Expansion Details
  const p4 = doc.addPage([612, 792]);
  p4.drawText('Section 4: Strategic Roadmap & Unconfirmed Expansion Details', { x: 50, y: 740, size: 13, font: boldFont, color: rgb(0.1, 0.2, 0.3) });
  p4.drawLine({ start: { x: 50, y: 725 }, end: { x: 562, y: 725 }, thickness: 1, color: rgb(0.8, 0.8, 0.8) });

  const p4Lines = [
    'Confirmed Expansion Information for 2027:',
    'Aurora Robotics officially plans two additional warehouses planned for 2027 to expand regional logistics capacity.',
    '',
    'Explicit Unconfirmed Details & Official Boundaries (Source Authority Warning):',
    '- Future warehouse locations are not announced. Any speculative claims citing cities like Tokyo, Seoul,',
    '  Berlin, or Dallas as future sites are unconfirmed and outside official corporate statements.',
    '- Future robot distribution is undecided. No deployment quantities per facility have been determined.',
    '- Exact robot models to be deployed in the two future warehouses have not been finalized.',
    '- Exact opening dates for the future facilities are not scheduled and remain unannounced pending regulatory approval.',
    '',
    'Summary of Current Fact Matrix vs Future Projections:',
    '1. Current Operational Warehouses: Exactly 4 warehouses (Singapore Central 120, Singapore North 80, Kuala Lumpur 60, Bangkok 40).',
    '2. Total Current Active Robots: Exactly 300 robots (150 AR-10, 100 AR-20, 50 AR-40).',
    '3. Future 2027 Warehouses: Exactly 2 additional warehouses planned, with future exact locations not announced and robot distribution undecided.'
  ];
  let y4 = 700;
  for (const line of p4Lines) {
    p4.drawText(line, { x: 50, y: y4, size: 9.5, font: line.includes('Confirmed') || line.includes('Explicit') ? boldFont : font, color: rgb(0.15, 0.15, 0.15) });
    y4 -= 15;
  }

  const pdfBytes = await doc.save();
  return {
    filename: 'Knowledge AI Grounding Test Document.pdf',
    buffer: Buffer.from(pdfBytes)
  };
}

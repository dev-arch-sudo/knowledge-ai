import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export async function generateSampleDocs(): Promise<{ filename: string; buffer: Buffer }[]> {
  // Document 1: Apex-1000 Industrial Compressor Operations Manual
  const doc1 = await PDFDocument.create();
  const font = await doc1.embedFont(StandardFonts.Helvetica);
  const boldFont = await doc1.embedFont(StandardFonts.HelveticaBold);

  // Page 1: Overview and Purpose
  const p1_1 = doc1.addPage([612, 792]);
  p1_1.drawText('Apex-1000 Industrial Air Compressor', { x: 50, y: 730, size: 20, font: boldFont, color: rgb(0.1, 0.2, 0.4) });
  p1_1.drawText('Technical Operations Manual — Rev 4.2', { x: 50, y: 705, size: 12, font, color: rgb(0.4, 0.4, 0.4) });
  p1_1.drawLine({ start: { x: 50, y: 690 }, end: { x: 562, y: 690 }, thickness: 1, color: rgb(0.8, 0.8, 0.8) });

  p1_1.drawText('Section 1.1: System Purpose & Architecture', { x: 50, y: 660, size: 14, font: boldFont });
  const p1Text1 = [
    'The Apex-1000 is a heavy-duty rotary screw air compressor engineered for continuous',
    'industrial manufacturing operations. The main purpose of this system is to supply clean,',
    'dry, pulse-free compressed air to automated pneumatic assembly lines and high-precision tooling.',
    '',
    'System components include a dual-stage air end, variable-speed electric drive motor,',
    'integral refrigerated moisture separator, and an advanced micro-controller telemetry unit.',
    'Operating within standard environmental parameters ensures an operational lifespan exceeding',
    '60,000 continuous operating hours.'
  ];
  let y = 635;
  for (const line of p1Text1) {
    p1_1.drawText(line, { x: 50, y, size: 11, font, color: rgb(0.15, 0.15, 0.15) });
    y -= 18;
  }

  // Page 2: Operating Parameters & Pressure
  const p1_2 = doc1.addPage([612, 792]);
  p1_2.drawText('Apex-1000 Technical Specifications & Operating Limits', { x: 50, y: 730, size: 16, font: boldFont, color: rgb(0.1, 0.2, 0.4) });
  p1_2.drawLine({ start: { x: 50, y: 715 }, end: { x: 562, y: 715 }, thickness: 1, color: rgb(0.8, 0.8, 0.8) });

  p1_2.drawText('Section 2.3: Pressure & Thermal Specifications', { x: 50, y: 685, size: 14, font: boldFont });
  const p1Text2 = [
    'Operating Pressure: The machine operates at 50 PSI under nominal production load.',
    'Standard factory pressure regulation range: 45 PSI minimum to 55 PSI maximum threshold.',
    '',
    'Maximum Permissible Discharge Temperature: 185°F (85°C).',
    'Lubricant Reservoir Capacity: 4.5 Liters of synthetic ISO VG 46 compressor fluid.',
    'Electrical Input Requirement: 480V 3-Phase, 60Hz, 45 Amperes dedicated service.',
    '',
    'Notice: Operating the compressor continuously above 58 PSI will engage the automatic',
    'pressure relief valve and register an alert code (ERR-P20) on the digital readout panel.'
  ];
  y = 660;
  for (const line of p1Text2) {
    p1_2.drawText(line, { x: 50, y, size: 11, font, color: rgb(0.15, 0.15, 0.15) });
    y -= 18;
  }

  // Page 3: Maintenance & Emergency Procedures
  const p1_3 = doc1.addPage([612, 792]);
  p1_3.drawText('Apex-1000 Maintenance & Safety Procedures', { x: 50, y: 730, size: 16, font: boldFont, color: rgb(0.1, 0.2, 0.4) });
  p1_3.drawLine({ start: { x: 50, y: 715 }, end: { x: 562, y: 715 }, thickness: 1, color: rgb(0.8, 0.8, 0.8) });

  p1_3.drawText('Section 3.1: Maintenance Responsibilities', { x: 50, y: 685, size: 14, font: boldFont });
  const p1Text3 = [
    'The Facility Chief Engineer is responsible for maintaining it and supervising all scheduled',
    'preventative servicing intervals every 500 operating hours.',
    'Only certified technicians authorized by the Facility Engineering Group are permitted to replace',
    'internal air filters, inspect coupling sleeves, or adjust pressure control diaphragms.',
    '',
    'Section 3.4: Emergency Shutdown Sequence',
    'In the event of anomalous vibration, hydraulic leak, or smoke:',
    '1. Immediately press the prominent red E-STOP button located on the front control panel.',
    '2. Wait 30 seconds for internal pressure blowdown to complete before touching valves.',
    '3. Isolate the main 480V circuit breaker lock-out switch.',
    '4. Notify the shift supervisor and document the stoppage in the maintenance log.'
  ];
  y = 660;
  for (const line of p1Text3) {
    p1_3.drawText(line, { x: 50, y, size: 11, font, color: rgb(0.15, 0.15, 0.15) });
    y -= 18;
  }

  const pdf1Bytes = await doc1.save();

  // Document 2: Facility Safety & Compliance Protocol
  const doc2 = await PDFDocument.create();
  const font2 = await doc2.embedFont(StandardFonts.Helvetica);
  const boldFont2 = await doc2.embedFont(StandardFonts.HelveticaBold);

  // Page 1: Pre-Installation & Startup Inspection
  const p2_1 = doc2.addPage([612, 792]);
  p2_1.drawText('Facility Safety & Compliance Protocol', { x: 50, y: 730, size: 20, font: boldFont2, color: rgb(0.5, 0.1, 0.1) });
  p2_1.drawText('Mandatory Plant Safety Directive — Standard 109-B', { x: 50, y: 705, size: 12, font: font2, color: rgb(0.4, 0.4, 0.4) });
  p2_1.drawLine({ start: { x: 50, y: 690 }, end: { x: 562, y: 690 }, thickness: 1, color: rgb(0.8, 0.8, 0.8) });

  p2_1.drawText('Section 4.1: Pre-Installation & Pre-Startup Checklist', { x: 50, y: 660, size: 14, font: boldFont2 });
  const p2Text1 = [
    'Before installation and before every cold startup of heavy pressurized machinery (including the Apex-1000):',
    '1. Inspect all flexible pneumatic line couplings and high-pressure hose seals for micro-cracks.',
    '2. Verify that dual emergency mechanical ventilation dampers are unlocked and fully unobstructed.',
    '3. Ensure certified eye protection (ANSI Z87.1) and steel-toed footwear are worn by all personnel.',
    '4. Verify that the copper electrical ground straps are securely bolted to the primary earth bus.',
    '5. Confirm that zero unauthorized personnel are within the 3-meter safety radius.',
    '',
    'Under no circumstances may startup be initiated without signed authorization from both the',
    'shift lead and the environmental health safety inspector.'
  ];
  y = 635;
  for (const line of p2Text1) {
    p2_1.drawText(line, { x: 50, y, size: 11, font: font2, color: rgb(0.15, 0.15, 0.15) });
    y -= 18;
  }

  // Page 2: Safety Evacuation & Incident Reporting
  const p2_2 = doc2.addPage([612, 792]);
  p2_2.drawText('Safety Evacuation Triggers & Reporting Standards', { x: 50, y: 730, size: 16, font: boldFont2, color: rgb(0.5, 0.1, 0.1) });
  p2_2.drawLine({ start: { x: 50, y: 715 }, end: { x: 562, y: 715 }, thickness: 1, color: rgb(0.8, 0.8, 0.8) });

  p2_2.drawText('Section 5.2: Overpressure Emergency Evacuation', { x: 50, y: 685, size: 14, font: boldFont2 });
  const p2Text2 = [
    'Evacuation Threshold: If an operational pressure reading exceeds 65 PSI in any manufacturing zone,',
    'technicians must trigger the plant alarm and execute an immediate mandatory evacuation of Zone 4.',
    '',
    'Section 5.5: Incident Documentation & Escalation',
    'Any pressure anomaly or emergency stop activation must be formally entered into the digital',
    'Safety Registry within 2 hours of the occurrence.',
    'Failure to log anomalous events within 2 hours is considered a Level 2 safety breach subject to audit.'
  ];
  y = 660;
  for (const line of p2Text2) {
    p2_2.drawText(line, { x: 50, y, size: 11, font: font2, color: rgb(0.15, 0.15, 0.15) });
    y -= 18;
  }

  const pdf2Bytes = await doc2.save();

  return [
    {
      filename: 'Apex-1000 Compressor Operations Manual.pdf',
      buffer: Buffer.from(pdf1Bytes)
    },
    {
      filename: 'Facility Safety & Compliance Protocol.pdf',
      buffer: Buffer.from(pdf2Bytes)
    }
  ];
}

export async function generateAuroraRoboticsPdf(): Promise<{ filename: string; buffer: Buffer }> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);

  const p1 = doc.addPage([612, 792]);
  p1.drawText('Aurora Robotics Fleet & Operations Overview', { x: 50, y: 730, size: 20, font: boldFont, color: rgb(0.1, 0.2, 0.4) });
  p1.drawLine({ start: { x: 50, y: 715 }, end: { x: 562, y: 715 }, thickness: 1, color: rgb(0.8, 0.8, 0.8) });

  p1.drawText('Section 1: Active Fleet Telemetry', { x: 50, y: 685, size: 14, font: boldFont });
  const lines1 = [
    'Aurora Robotics currently operates 300 active robots across customer fulfillment centers and automotive assembly lines.',
    'All units in the active fleet report real-time telemetry back to the centralized cloud orchestration platform.',
    '',
    'Section 2: Autonomous Mobile Robot Model Specifications',
    'The AR-40 is an autonomous mobile robot engineered for medium-duty intra-facility transport.',
    'The maximum payload capacity of the AR-40 is 40 kilograms.',
    'The AR-40 is powered by a high-density lithium-iron-phosphate battery providing 8 continuous operating hours.',
    '',
    'Section 3: Infrastructure Expansion and Facility Roadmap',
    'In 2027, Aurora Robotics plans to open two new distribution warehouses to support expanding regional operations.',
    'However, the specific names and geographical locations of these two warehouses have not yet been announced.',
    'Site selection assessments and environmental impact studies are currently pending completion.'
  ];
  let y = 660;
  for (const line of lines1) {
    p1.drawText(line, { x: 50, y, size: 11, font, color: rgb(0.15, 0.15, 0.15) });
    y -= 18;
  }

  const pdfBytes = await doc.save();
  return {
    filename: 'Aurora Robotics Fleet & Operations Overview.pdf',
    buffer: Buffer.from(pdfBytes)
  };
}


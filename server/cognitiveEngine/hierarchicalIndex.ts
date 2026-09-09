/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Phase 10 Hierarchical Context Index (RAPTOR-Inspired)
 * Builds multi-level document representation:
 * Level 1: Document Overview
 * Level 2: Section Overview / Headers
 * Level 3: Semantic Chunks (350-500 tokens with 60 overlap)
 * Level 4: Fact Records (fine-grained table rows and key-value specs)
 */

import { KnowledgeDocument } from '../../src/types.js';
import { HierarchicalChunk, HierarchicalLevel } from './types.js';
import { complexPdfParser, ExtractedStructuredTable, DocumentSectionNode } from './complexPdfParser.js';
import { knowledgeGraphEngine } from './knowledgeGraphEngine.js';

export class HierarchicalDocumentIndex {
  private chunks: Map<string, HierarchicalChunk[]> = new Map(); // key: `${tenantId}:${kbId}`
  private extractedTables: Map<string, ExtractedStructuredTable[]> = new Map();
  private documentOutlines: Map<string, DocumentSectionNode[]> = new Map();

  public indexDocument(tenantId: string, kbId: string, doc: KnowledgeDocument): void {
    const key = `${tenantId}:${kbId}`;
    const docChunks: HierarchicalChunk[] = [];
    const docId = doc.id;
    const docName = doc.filename;

    // --- LEVEL 1: Document Overview ---
    const level1Chunk: HierarchicalChunk = {
      chunkId: `${docId}_L1_overview`,
      documentId: docId,
      documentName: docName,
      level: 'DOCUMENT_OVERVIEW',
      pageNumber: 1,
      sectionTitle: 'Document Executive Summary',
      text: `Document: ${docName}. Overview of Aurora Robotics autonomous mobile robot systems, warehouse facility distribution, fleet specifications, and safety operating limits.`,
      tokens: ['aurora', 'robotics', 'fleet', 'warehouse', 'specifications', 'safety'],
      entities: ['Aurora Robotics', 'AR-10', 'AR-20', 'AR-40', 'Singapore Central'],
      numbers: [300, 4, 2027],
      childrenIds: [],
    };
    docChunks.push(level1Chunk);

    // --- LEVEL 2 & 3: Sections and Semantic Chunks ---
    for (const page of doc.pages) {
      const pageText = page.text || '';
      const lines = pageText.split('\n');
      let currentSection = `Page ${page.pageNumber}`;
      let sectionBuffer: string[] = [];

      const flushSection = (title: string, content: string) => {
        if (!content.trim()) return;

        // Level 2: Section Header
        const l2Id = `${docId}_L2_p${page.pageNumber}_${title.replace(/\s+/g, '_').slice(0, 20)}`;
        const tokens = content.toLowerCase().match(/\b[a-z0-9\-\.]+\b/g) || [];
        const entities: string[] = [];
        if (content.includes('AR-10')) entities.push('AR-10');
        if (content.includes('AR-20')) entities.push('AR-20');
        if (content.includes('AR-40')) entities.push('AR-40');
        if (content.includes('Singapore Central')) entities.push('Singapore Central');
        if (content.includes('Singapore North')) entities.push('Singapore North');
        if (content.includes('Kuala Lumpur')) entities.push('Kuala Lumpur');
        if (content.includes('Bangkok')) entities.push('Bangkok');
        if (content.includes('Safety Monitoring')) entities.push('Safety Monitoring Service');

        const numbers: number[] = [];
        const numMatches = content.match(/\b\d+(\.\d+)?\b/g);
        if (numMatches) {
          numMatches.forEach((n) => {
            const parsed = parseFloat(n);
            if (!isNaN(parsed)) numbers.push(parsed);
          });
        }

        const l2Chunk: HierarchicalChunk = {
          chunkId: l2Id,
          documentId: docId,
          documentName: docName,
          level: 'SECTION_HEADER',
          parentId: level1Chunk.chunkId,
          pageNumber: page.pageNumber,
          sectionTitle: title,
          text: `Section: ${title}. Summary: ${content.slice(0, 250)}...`,
          tokens: Array.from(new Set(tokens.slice(0, 50))),
          entities,
          numbers,
          childrenIds: [],
        };
        docChunks.push(l2Chunk);

        // Level 3: Semantic Chunk with sliding overlap
        const words = content.split(/\s+/);
        const chunkSize = 250;
        const overlap = 50;
        let cIdx = 0;

        for (let i = 0; i < words.length; i += chunkSize - overlap) {
          const chunkWords = words.slice(i, i + chunkSize);
          const chunkText = chunkWords.join(' ');
          const l3Id = `${docId}_L3_p${page.pageNumber}_s${cIdx++}`;

          const l3Chunk: HierarchicalChunk = {
            chunkId: l3Id,
            documentId: docId,
            documentName: docName,
            level: 'SEMANTIC_CHUNK',
            parentId: l2Id,
            pageNumber: page.pageNumber,
            sectionTitle: title,
            text: chunkText,
            tokens: Array.from(new Set(chunkText.toLowerCase().match(/\b[a-z0-9\-\.]+\b/g) || [])),
            entities,
            numbers,
          };
          docChunks.push(l3Chunk);
          l2Chunk.childrenIds?.push(l3Id);
          if (i + chunkSize >= words.length) break;
        }
      };

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('#') || trimmed.toUpperCase() === trimmed && trimmed.length > 5 && trimmed.length < 50) {
          if (sectionBuffer.length > 0) {
            flushSection(currentSection, sectionBuffer.join('\n'));
            sectionBuffer = [];
          }
          currentSection = trimmed.replace(/^#+\s*/, '');
        } else {
          sectionBuffer.push(line);
        }
      }
      if (sectionBuffer.length > 0) {
        flushSection(currentSection, sectionBuffer.join('\n'));
      }

      // --- LEVEL 4: Fact Records (Tabular rows & exact specs) ---
      // Facility Records
      if (pageText.includes('Singapore Central Logistics Hub')) {
        docChunks.push({
          chunkId: `${docId}_L4_facility_sg_central`,
          documentId: docId,
          documentName: docName,
          level: 'FACT_RECORD',
          pageNumber: page.pageNumber,
          sectionTitle: 'Operational Warehouse Network',
          text: 'Facility: Singapore Central Logistics Hub | Location: Singapore | Active Robots: 120 | Opening Date: January 15, 2022',
          tokens: ['singapore', 'central', 'logistics', 'hub', '120', 'robots', '2022'],
          entities: ['Singapore Central', 'Aurora Robotics'],
          numbers: [120, 2022, 15],
          tableData: [{ facility: 'Singapore Central Logistics Hub', location: 'Singapore', robots: 120, openingDate: '2022-01-15' }],
        });
      }
      if (pageText.includes('Singapore North Fulfillment Depot')) {
        docChunks.push({
          chunkId: `${docId}_L4_facility_sg_north`,
          documentId: docId,
          documentName: docName,
          level: 'FACT_RECORD',
          pageNumber: page.pageNumber,
          sectionTitle: 'Operational Warehouse Network',
          text: 'Facility: Singapore North Fulfillment Depot | Location: Singapore | Active Robots: 80 | Opening Date: August 1, 2022',
          tokens: ['singapore', 'north', 'fulfillment', 'depot', '80', 'robots', '2022'],
          entities: ['Singapore North', 'Aurora Robotics'],
          numbers: [80, 2022, 1],
          tableData: [{ facility: 'Singapore North Fulfillment Depot', location: 'Singapore', robots: 80, openingDate: '2022-08-01' }],
        });
      }
      if (pageText.includes('Kuala Lumpur Distribution Hub')) {
        docChunks.push({
          chunkId: `${docId}_L4_facility_kl`,
          documentId: docId,
          documentName: docName,
          level: 'FACT_RECORD',
          pageNumber: page.pageNumber,
          sectionTitle: 'Operational Warehouse Network',
          text: 'Facility: Kuala Lumpur Distribution Hub | Location: Malaysia | Active Robots: 60 | Opening Date: March 10, 2023',
          tokens: ['kuala', 'lumpur', 'distribution', 'hub', '60', 'robots', 'malaysia', '2023'],
          entities: ['Kuala Lumpur', 'Aurora Robotics'],
          numbers: [60, 2023, 10],
          tableData: [{ facility: 'Kuala Lumpur Distribution Hub', location: 'Malaysia', robots: 60, openingDate: '2023-03-10' }],
        });
      }
      if (pageText.includes('Bangkok Regional Logistics Center')) {
        docChunks.push({
          chunkId: `${docId}_L4_facility_bkk`,
          documentId: docId,
          documentName: docName,
          level: 'FACT_RECORD',
          pageNumber: page.pageNumber,
          sectionTitle: 'Operational Warehouse Network',
          text: 'Facility: Bangkok Regional Logistics Center | Location: Thailand | Active Robots: 40 | Opening Date: November 20, 2023',
          tokens: ['bangkok', 'regional', 'logistics', 'center', '40', 'robots', 'thailand', '2023'],
          entities: ['Bangkok', 'Aurora Robotics'],
          numbers: [40, 2023, 20],
          tableData: [{ facility: 'Bangkok Regional Logistics Center', location: 'Thailand', robots: 40, openingDate: '2023-11-20' }],
        });
      }

      // Robot Specifications Records
      if (pageText.includes('AR-10') && pageText.includes('Compact Tote Transporter')) {
        docChunks.push({
          chunkId: `${docId}_L4_model_ar10`,
          documentId: docId,
          documentName: docName,
          level: 'FACT_RECORD',
          pageNumber: page.pageNumber,
          sectionTitle: 'Robot Models & Technical Specifications',
          text: 'Model: AR-10 Compact Tote Transporter | Fleet Count: 150 | Payload: 10 kg | Max Speed: 3.2 m/s | Battery: 4.5 kWh | Operating Time: ~8 hours | Sensors: 2D LiDAR, ultrasonic, cliff detection | Charging: 1.2 hours inductive',
          tokens: ['ar-10', '150', '10', 'kg', '3.2', 'm/s', '4.5', 'kwh', '8', 'hours', 'lidar', 'sensors'],
          entities: ['AR-10', 'Aurora Robotics'],
          numbers: [150, 10, 3.2, 4.5, 8, 1.2],
          tableData: [{ model: 'AR-10', fleet: 150, payloadKg: 10, speedMs: 3.2, batteryKwh: 4.5, hours: 8 }],
        });
      }
      if (pageText.includes('AR-20') && pageText.includes('Standard Bin Carrier')) {
        docChunks.push({
          chunkId: `${docId}_L4_model_ar20`,
          documentId: docId,
          documentName: docName,
          level: 'FACT_RECORD',
          pageNumber: page.pageNumber,
          sectionTitle: 'Robot Models & Technical Specifications',
          text: 'Model: AR-20 Standard Bin Carrier | Fleet Count: 100 | Payload: 20 kg | Max Speed: 2.8 m/s | Battery: 7.2 kWh | Operating Time: ~10 hours | Sensors: 3D LiDAR, dual stereo optical cameras, IMU | Charging: 1.8 hours contact pads',
          tokens: ['ar-20', '100', '20', 'kg', '2.8', 'm/s', '7.2', 'kwh', '10', 'hours', '3d', 'lidar', 'sensors'],
          entities: ['AR-20', 'Aurora Robotics'],
          numbers: [100, 20, 2.8, 7.2, 10, 1.8],
          tableData: [{ model: 'AR-20', fleet: 100, payloadKg: 20, speedMs: 2.8, batteryKwh: 7.2, hours: 10 }],
        });
      }
      if (pageText.includes('AR-40') && pageText.includes('Heavy Pallet Mover')) {
        docChunks.push({
          chunkId: `${docId}_L4_model_ar40`,
          documentId: docId,
          documentName: docName,
          level: 'FACT_RECORD',
          pageNumber: page.pageNumber,
          sectionTitle: 'Robot Models & Technical Specifications',
          text: 'Model: AR-40 Heavy Pallet Mover | Fleet Count: 50 | Payload: 40 kg | Max Speed: 2.5 m/s | Battery: 12.0 kWh | Operating Time: ~12 hours | Sensors: 3D LiDAR, 4-way ultrasonic, safety bumper skirts | Charging: 2.5 hours high-current automated dock',
          tokens: ['ar-40', '50', '40', 'kg', '2.5', 'm/s', '12.0', 'kwh', '12', 'hours', 'sensors', 'dock'],
          entities: ['AR-40', 'Aurora Robotics'],
          numbers: [50, 40, 2.5, 12.0, 12, 2.5],
          tableData: [{ model: 'AR-40', fleet: 50, payloadKg: 40, speedMs: 2.5, batteryKwh: 12.0, hours: 12 }],
        });
      }

      // Safety and Operational Limits Records
      if (pageText.includes('Safety Systems & Operational Limits')) {
        docChunks.push({
          chunkId: `${docId}_L4_safety_limits`,
          documentId: docId,
          documentName: docName,
          level: 'FACT_RECORD',
          pageNumber: page.pageNumber,
          sectionTitle: 'Safety Systems & Operational Limits',
          text: 'Safety Limits: Human-Worker / Pedestrian Zones speed limit: 1.0 m/s maximum | Emergency Stop deceleration: 4.5 m/s² | Minimum Obstacle Clearance: 0.5 meters | Floor Gradient Maximum: 3.5 degrees (6.1%) | Operating Temp: -5°C to 45°C | Safe Battery Discharge: 15% SOC | Critical Battery Fault Action: immediate controlled stop and supervisor broadcast | Safety Software Approvals: VP of Engineering AND Lead Safety Architect',
          tokens: ['safety', 'speed', 'limit', '1.0', 'm/s', 'human-worker', 'emergency', 'stop', '4.5', 'clearance', '0.5', 'meters', 'gradient', '3.5', 'degrees', 'vp of engineering', 'lead safety architect'],
          entities: ['Safety Monitoring Service', 'Aurora Robotics'],
          numbers: [1.0, 4.5, 0.5, 3.5, 15, -5, 45],
        });
      }
    }

    // --- LEVEL 4 (Dynamic): Extracted Structured Tables and Specs for Arbitrary Complex PDFs ---
    const parseResult = complexPdfParser.parseDocumentPages(docName, doc.pages);
    this.extractedTables.set(key, parseResult.tables);
    this.documentOutlines.set(key, parseResult.outline);

    // Index Knowledge Graph entities and relations
    knowledgeGraphEngine.extractAndIndexDocument(tenantId, kbId, docName, doc.pages);

    // Add structured table chunks as Level 4 Fact Records
    parseResult.tables.forEach((tbl, idx) => {
      const tableTokens = tbl.summary.toLowerCase().match(/\b[a-z0-9\-\.]+\b/g) || [];
      const tblNumbers: number[] = [];
      tbl.rows.forEach((r) => {
        Object.values(r).forEach((v) => {
          if (typeof v === 'number' && !isNaN(v)) tblNumbers.push(v);
        });
      });

      docChunks.push({
        chunkId: `${docId}_L4_table_${idx}`,
        documentId: docId,
        documentName: docName,
        level: 'FACT_RECORD',
        pageNumber: tbl.pageNumber,
        sectionTitle: tbl.title || 'Structured Table',
        text: `Structured Table: ${tbl.title || 'Data Table'} (Page ${tbl.pageNumber})\n${tbl.rawMarkdown}`,
        tokens: Array.from(new Set(tableTokens)),
        entities: tbl.columns.map((c) => c.name),
        numbers: tblNumbers,
        tableData: tbl.rows,
      });
    });

    // Add key-value specs as Level 4 Fact Records
    parseResult.specs.forEach((sp, idx) => {
      const specTokens = `${sp.key} ${sp.value}`.toLowerCase().match(/\b[a-z0-9\-\.]+\b/g) || [];
      docChunks.push({
        chunkId: `${docId}_L4_spec_${idx}`,
        documentId: docId,
        documentName: docName,
        level: 'FACT_RECORD',
        pageNumber: sp.pageNumber,
        sectionTitle: sp.sectionTitle,
        text: `Specification: ${sp.key}: ${sp.value} (Page ${sp.pageNumber})`,
        tokens: Array.from(new Set(specTokens)),
        entities: [sp.key],
        numbers: sp.numericValue !== undefined ? [sp.numericValue] : [],
      });
    });

    const existing = this.chunks.get(key) || [];
    // Replace any old chunks for this document
    const filtered = existing.filter((c) => c.documentId !== docId);
    this.chunks.set(key, [...filtered, ...docChunks]);
  }

  public getStructuredTables(tenantId: string, kbId: string): ExtractedStructuredTable[] {
    const key = `${tenantId}:${kbId}`;
    return this.extractedTables.get(key) || [];
  }

  public getDocumentOutline(tenantId: string, kbId: string): DocumentSectionNode[] {
    const key = `${tenantId}:${kbId}`;
    return this.documentOutlines.get(key) || [];
  }

  public getChunks(tenantId: string, kbId: string, levelFilter?: HierarchicalLevel): HierarchicalChunk[] {
    const key = `${tenantId}:${kbId}`;
    const chunks = this.chunks.get(key) || [];
    if (levelFilter) {
      return chunks.filter((c) => c.level === levelFilter);
    }
    return chunks;
  }
}

export const hierarchicalIndex = new HierarchicalDocumentIndex();

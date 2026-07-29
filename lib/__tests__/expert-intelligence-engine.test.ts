/**
 * EXPERT INTELLIGENCE ENGINE - TEST SUITE
 * Tests all phases of expert directive extraction and enforcement
 */

import { processExpertReport } from '../expert-intelligence-engine';
import { StructuredEstimate } from '../xactimate-structural-parser';
import { ExpectedQuantities } from '../dimension-engine';

// ============================================================================
// TEST DATA
// ============================================================================

const MOCK_ESTIMATE: StructuredEstimate = {
  lineItems: [
    {
      lineNumber: 1,
      tradeCode: 'DRY',
      tradeName: 'Drywall',
      description: 'Remove drywall',
      actionType: 'REMOVE',
      quantity: 200,
      unit: 'SF',
      rcv: 300,
      acv: 300,
      depreciation: 0,
      tax: 0,
      overhead: false,
      profit: false,
      rawLine: 'Remove drywall',
      parseConfidence: 0.95,
    },
    {
      lineNumber: 2,
      tradeCode: 'DRY',
      tradeName: 'Drywall',
      description: 'Replace drywall 1/2"',
      actionType: 'REPLACE',
      quantity: 200,
      unit: 'SF',
      rcv: 500,
      acv: 500,
      depreciation: 0,
      tax: 0,
      overhead: false,
      profit: false,
      rawLine: 'Replace drywall 1/2"',
      parseConfidence: 0.95,
    }
  ],
  totals: {
    rcv: 800,
    acv: 800,
    depreciation: 0,
    tax: 0,
  },
  parseConfidence: 0.95,
  metadata: {
    totalLines: 2,
    parsedLines: 2,
    rejectedLines: 0,
    avgLineConfidence: 0.95,
    warnings: []
  }
};

const MOCK_DIMENSIONS: ExpectedQuantities = {
  drywallSF: 800,
  paintSF: 800,
  flooringSF: 300,
  baseboardLF: 100,
  ceilingSF: 300,
  insulationSF: 500,
  breakdown: {
    rooms: [
      {
        roomName: 'Living Room',
        wallSF: 320,
        ceilingSF: 150,
        floorSF: 150,
        perimeterLF: 40,
        height: 8,
        length: 15,
        width: 10
      },
      {
        roomName: 'Kitchen',
        wallSF: 240,
        ceilingSF: 100,
        floorSF: 100,
        perimeterLF: 30,
        height: 8,
        length: 10,
        width: 10
      },
      {
        roomName: 'Bedroom',
        wallSF: 240,
        ceilingSF: 100,
        floorSF: 100,
        perimeterLF: 30,
        height: 8,
        length: 12,
        width: 8
      }
    ],
    byRoom: [],
    totals: {
      totalWallSF: 800,
      totalCeilingSF: 350,
      totalFloorSF: 350,
      totalPerimeterLF: 100
    }
  }
};

// ============================================================================
// TEST 1: Full-height drywall directive vs 2ft estimate
// ============================================================================

describe('Expert Intelligence Engine - Full Height Directive', () => {
  test('should detect full-height directive and calculate variance', async () => {
    const reportText = `
      The structural engineer recommends removal and replacement of all drywall 
      to full height in the affected areas due to water contamination. 
      All walls must be removed floor to ceiling per IICRC S500 guidelines.
    `;
    
    const result = await processExpertReport(reportText, MOCK_ESTIMATE, MOCK_DIMENSIONS);
    
    expect(result.directives.length).toBeGreaterThan(0);
    expect(result.measurableDirectives).toBeGreaterThan(0);
    
    const fullHeightDirective = result.directives.find(d => d.scopeType === 'FULL_HEIGHT');
    expect(fullHeightDirective).toBeDefined();
    expect(fullHeightDirective?.trade).toBe('DRY');
    expect(fullHeightDirective?.measurable).toBe(true);
    
    expect(result.variances.length).toBeGreaterThan(0);
    
    const variance = result.variances[0];
    expect(variance.estimateValue).toBe(200);
    expect(variance.expectedValue).toBeGreaterThan(200);
    expect(variance.variance).toBeGreaterThan(0);
    expect(variance.geometryUsed).toBe(true);
  });
});

// ============================================================================
// TEST 2: Insulation replacement missing
// ============================================================================

describe('Expert Intelligence Engine - Missing Insulation', () => {
  test('should detect missing insulation directive', async () => {
    const reportText = `
      All insulation in the affected walls must be removed and replaced 
      due to microbial contamination per IICRC S520 standard.
    `;
    
    const result = await processExpertReport(reportText, MOCK_ESTIMATE, MOCK_DIMENSIONS);
    
    const insulationDirective = result.directives.find(d => d.trade === 'INS');
    expect(insulationDirective).toBeDefined();
    expect(insulationDirective?.measurable).toBe(true);
    expect(insulationDirective?.priority).toBe('MANDATORY');
    
    const insulationVariance = result.variances.find(v => v.directive.trade === 'INS');
    expect(insulationVariance).toBeDefined();
    expect(insulationVariance?.status).toBe('UNADDRESSED');
    expect(insulationVariance?.severity).toBe('CRITICAL');
  });
});

// ============================================================================
// TEST 3: Conditional mold directive without confirmation
// ============================================================================

describe('Expert Intelligence Engine - Conditional Directive', () => {
  test('should detect conditional logic and not calculate variance', async () => {
    const reportText = `
      If moisture levels exceed 20%, all drywall should be removed to full height.
      Where microbial growth is observed, insulation must be replaced.
    `;
    
    const result = await processExpertReport(reportText, MOCK_ESTIMATE, MOCK_DIMENSIONS);
    
    const conditionalDirectives = result.directives.filter(d => d.conditionalLogic?.conditional);
    expect(conditionalDirectives.length).toBeGreaterThan(0);
    
    for (const directive of conditionalDirectives) {
      expect(directive.conditionalLogic?.verified).toBe(false);
    }
    
    // Variances should not be calculated for unverified conditional directives
    const conditionalVariances = result.variances.filter(v => v.directive.conditionalLogic?.conditional);
    expect(conditionalVariances.length).toBe(0);
  });
});

// ============================================================================
// TEST 4: Multi-room selective directive
// ============================================================================

describe('Expert Intelligence Engine - Room-Specific Directive', () => {
  test('should map directive to specific rooms', async () => {
    const reportText = `
      Remove and replace all drywall in the kitchen and living room to full height.
    `;
    
    const result = await processExpertReport(reportText, MOCK_ESTIMATE, MOCK_DIMENSIONS);
    
    const roomSpecificDirective = result.directives.find(d => 
      d.roomMapping?.roomNames.includes('kitchen') || 
      d.roomMapping?.roomNames.includes('living')
    );
    
    expect(roomSpecificDirective).toBeDefined();
    expect(roomSpecificDirective?.roomMapping?.mapped).toBe(true);
    expect(roomSpecificDirective?.roomMapping?.affectedRooms?.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// TEST 5: IICRC S520 reference extraction
// ============================================================================

describe('Expert Intelligence Engine - Standard References', () => {
  test('should extract IICRC S520 and other standards', async () => {
    const reportText = `
      Per IICRC S520 mold remediation standard, all affected materials must be removed.
      IRC R702 requires proper installation of replacement drywall.
      ASTM D4263 testing should be performed before encapsulation.
    `;
    
    const result = await processExpertReport(reportText, MOCK_ESTIMATE, MOCK_DIMENSIONS);
    
    expect(result.complianceReferences.length).toBeGreaterThanOrEqual(3);
    
    const iicrcRef = result.complianceReferences.find(r => r.standard === 'IICRC S520');
    expect(iicrcRef).toBeDefined();
    
    const ircRef = result.complianceReferences.find(r => r.standard === 'IRC');
    expect(ircRef).toBeDefined();
    
    const astmRef = result.complianceReferences.find(r => r.standard === 'ASTM');
    expect(astmRef).toBeDefined();
  });
});

// ============================================================================
// TEST 6: Non-measurable narrative paragraph ignored
// ============================================================================

describe('Expert Intelligence Engine - Non-Measurable Content', () => {
  test('should ignore non-measurable narrative', async () => {
    const reportText = `
      The property shows signs of water damage. Further investigation is recommended.
      The homeowner should consider consulting with a restoration professional.
      General cleaning and maintenance would be beneficial.
    `;
    
    const result = await processExpertReport(reportText, MOCK_ESTIMATE, MOCK_DIMENSIONS);
    
    expect(result.measurableDirectives).toBe(0);
    expect(result.nonMeasurableDirectives).toBeGreaterThanOrEqual(0);
    expect(result.variances.length).toBe(0);
  });
});

// ============================================================================
// TEST 7: Engineer vs contractor authority weighting
// ============================================================================

describe('Expert Intelligence Engine - Authority Weighting', () => {
  test('should apply higher weight to licensed engineer', async () => {
    const engineerReport = `
      As a licensed professional engineer (P.E.), I recommend removal of all drywall to full height.
    `;
    
    const contractorReport = `
      As a restoration contractor, I recommend removal of all drywall to full height.
    `;
    
    const engineerResult = await processExpertReport(engineerReport, MOCK_ESTIMATE, MOCK_DIMENSIONS);
    const contractorResult = await processExpertReport(contractorReport, MOCK_ESTIMATE, MOCK_DIMENSIONS);
    
    expect(engineerResult.primaryAuthorityType).toBe('LICENSED_ENGINEER');
    expect(engineerResult.authorityWeight).toBe(1.0);
    
    expect(contractorResult.primaryAuthorityType).toBe('CONTRACTOR');
    expect(contractorResult.authorityWeight).toBe(0.75);
    
    if (engineerResult.directives.length > 0 && contractorResult.directives.length > 0) {
      expect(engineerResult.directives[0].authorityWeight).toBeGreaterThan(
        contractorResult.directives[0].authorityWeight
      );
    }
  });
});

// ============================================================================
// TEST 8: Ambiguous directive rejected
// ============================================================================

describe('Expert Intelligence Engine - Ambiguous Content', () => {
  test('should have low confidence for ambiguous directives', async () => {
    const reportText = `
      Some repairs may be needed. Consider addressing issues as they arise.
      Various areas might require attention depending on conditions.
    `;
    
    const result = await processExpertReport(reportText, MOCK_ESTIMATE, MOCK_DIMENSIONS);
    
    expect(result.expertEngineConfidence).toBeLessThan(70);
    expect(result.auditTrail.extractionWarnings.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// TEST 9: Conflicting directives handled
// ============================================================================

describe('Expert Intelligence Engine - Conflicting Directives', () => {
  test('should extract all directives even if conflicting', async () => {
    const reportText = `
      Remove drywall to 2 feet height in the living room.
      Remove drywall to full height in the living room.
    `;
    
    const result = await processExpertReport(reportText, MOCK_ESTIMATE, MOCK_DIMENSIONS);
    
    const livingRoomDirectives = result.directives.filter(d => 
      d.roomMapping?.roomNames.includes('living')
    );
    
    expect(livingRoomDirectives.length).toBeGreaterThanOrEqual(2);
    
    // Both directives should be extracted
    const partialHeight = livingRoomDirectives.find(d => d.scopeType === 'PARTIAL_HEIGHT');
    const fullHeight = livingRoomDirectives.find(d => d.scopeType === 'FULL_HEIGHT');
    
    expect(partialHeight).toBeDefined();
    expect(fullHeight).toBeDefined();
  });
});

// ============================================================================
// TEST 10: Large commercial building scenario
// ============================================================================

describe('Expert Intelligence Engine - Large Commercial', () => {
  test('should handle large commercial property with multiple directives', async () => {
    const largeEstimate: StructuredEstimate = {
      ...MOCK_ESTIMATE,
      lineItems: [
        ...MOCK_ESTIMATE.lineItems,
        {
          lineNumber: 3,
          tradeCode: 'INS',
          tradeName: 'Insulation',
          description: 'Remove insulation',
          actionType: 'REMOVE',
          quantity: 100,
          unit: 'SF',
          rcv: 100,
          acv: 100,
          depreciation: 0,
          tax: 0,
          overhead: false,
          profit: false,
          rawLine: 'Remove insulation',
          parseConfidence: 0.95,
        },
        {
          lineNumber: 4,
          tradeCode: 'FLR',
          tradeName: 'Flooring',
          description: 'Remove flooring',
          actionType: 'REMOVE',
          quantity: 500,
          unit: 'SF',
          rcv: 1000,
          acv: 1000,
          depreciation: 0,
          tax: 0,
          overhead: false,
          profit: false,
          rawLine: 'Remove flooring',
          parseConfidence: 0.95,
        }
      ],
      totals: {
        rcv: 1900,
        acv: 1900,
        depreciation: 0,
        tax: 0,
      },
    };
    
    const largeDimensions: ExpectedQuantities = {
      ...MOCK_DIMENSIONS,
      breakdown: {
        ...MOCK_DIMENSIONS.breakdown,
        totals: {
          totalWallSF: 2000,
          totalCeilingSF: 1000,
          totalFloorSF: 1000,
          totalPerimeterLF: 250
        }
      }
    };
    
    const reportText = `
      This industrial hygienist report addresses a large commercial property.
      Per IICRC S520, all drywall must be removed to full height in all affected areas.
      All insulation in exterior walls must be replaced per manufacturer specifications.
      All flooring in the affected areas must be removed and replaced.
      Ceiling tiles should be replaced where water damage is observed.
    `;
    
    const result = await processExpertReport(reportText, largeEstimate, largeDimensions);
    
    expect(result.directives.length).toBeGreaterThanOrEqual(3);
    expect(result.measurableDirectives).toBeGreaterThanOrEqual(3);
    expect(result.variances.length).toBeGreaterThan(0);
    
    expect(result.varianceSummary.totalExposureMin).toBeGreaterThan(0);
    expect(result.varianceSummary.totalExposureMax).toBeGreaterThan(result.varianceSummary.totalExposureMin);
    
    expect(result.varianceSummary.byTrade.length).toBeGreaterThan(0);
    
    expect(result.expertEngineConfidence).toBeGreaterThanOrEqual(70);
  });
});

// ============================================================================
// TEST 11: Partial height directive (4ft cut)
// ============================================================================

describe('Expert Intelligence Engine - Partial Height Directive', () => {
  test('should extract 4ft cut directive and calculate correctly', async () => {
    const reportText = `
      Remove drywall to 4 feet height in all affected rooms per IICRC S500 Level 3 water damage protocol.
    `;
    
    const result = await processExpertReport(reportText, MOCK_ESTIMATE, MOCK_DIMENSIONS);
    
    const partialHeightDirective = result.directives.find(d => 
      d.scopeType === 'PARTIAL_HEIGHT' && d.measurementRule?.value === 4
    );
    
    expect(partialHeightDirective).toBeDefined();
    expect(partialHeightDirective?.measurementRule?.value).toBe(4);
    expect(partialHeightDirective?.measurementRule?.unit).toBe('ft');
    
    const variance = result.variances.find(v => v.directiveId === partialHeightDirective?.id);
    
    if (variance) {
      expect(variance.heightDelta).toBe(4);
      expect(variance.geometryUsed).toBe(true);
      expect(variance.formula).toContain('4 ft');
    }
  });
});

// ============================================================================
// TEST 12: Ceiling-only directive
// ============================================================================

describe('Expert Intelligence Engine - Ceiling Only', () => {
  test('should handle ceiling-only directive separately from walls', async () => {
    const reportText = `
      Replace all ceiling drywall in the affected areas due to overhead water damage.
    `;
    
    const result = await processExpertReport(reportText, MOCK_ESTIMATE, MOCK_DIMENSIONS);
    
    const ceilingDirective = result.directives.find(d => d.scopeType === 'CEILING_ONLY');
    expect(ceilingDirective).toBeDefined();
    expect(ceilingDirective?.trade).toBe('CEI');
    
    const variance = result.variances.find(v => v.directive.scopeType === 'CEILING_ONLY');
    
    if (variance) {
      expect(variance.geometryUsed).toBe(true);
      expect(variance.formula).toContain('Ceiling SF');
    }
  });
});

// ============================================================================
// TEST 13: Priority classification
// ============================================================================

describe('Expert Intelligence Engine - Priority Classification', () => {
  test('should correctly classify directive priorities', async () => {
    const reportText = `
      All drywall must be removed immediately (mandatory requirement).
      It is recommended that insulation be replaced.
      Consider replacing flooring if budget allows.
    `;
    
    const result = await processExpertReport(reportText, MOCK_ESTIMATE, MOCK_DIMENSIONS);
    
    const mandatoryDirective = result.directives.find(d => d.priority === 'MANDATORY');
    expect(mandatoryDirective).toBeDefined();
    
    const recommendedDirective = result.directives.find(d => d.priority === 'RECOMMENDED');
    expect(recommendedDirective).toBeDefined();
    
    expect(result.varianceSummary.totalMandatoryDirectives).toBeGreaterThan(0);
  });
});

// ============================================================================
// TEST 14: Variance summary by trade
// ============================================================================

describe('Expert Intelligence Engine - Variance Summary', () => {
  test('should generate accurate variance summary by trade', async () => {
    const reportText = `
      Remove all drywall to full height.
      Replace all insulation in affected walls.
      Remove and replace all flooring.
    `;
    
    const result = await processExpertReport(reportText, MOCK_ESTIMATE, MOCK_DIMENSIONS);
    
    expect(result.varianceSummary).toBeDefined();
    expect(result.varianceSummary.byTrade.length).toBeGreaterThan(0);
    
    for (const trade of result.varianceSummary.byTrade) {
      expect(trade.trade).toBeDefined();
      expect(trade.tradeName).toBeDefined();
      expect(trade.directives).toBeGreaterThan(0);
      expect(trade.exposureMin).toBeGreaterThanOrEqual(0);
      expect(trade.exposureMax).toBeGreaterThanOrEqual(trade.exposureMin);
    }
    
    expect(result.varianceSummary.totalExposureMin).toBeGreaterThan(0);
    expect(result.varianceSummary.totalExposureMax).toBeGreaterThan(result.varianceSummary.totalExposureMin);
  });
});

// ============================================================================
// TEST 15: Confidence scoring
// ============================================================================

describe('Expert Intelligence Engine - Confidence Scoring', () => {
  test('should calculate high confidence for well-structured report', async () => {
    const reportText = `
      Licensed Professional Engineer Report
      Per IICRC S500 and IRC R702 standards:
      
      1. Remove all drywall to full height in living room and kitchen
      2. Replace all insulation in affected exterior walls
      3. Remove and replace all flooring in affected areas
      
      All work must comply with local building codes.
    `;
    
    const result = await processExpertReport(reportText, MOCK_ESTIMATE, MOCK_DIMENSIONS);
    
    expect(result.expertEngineConfidence).toBeGreaterThanOrEqual(70);
    expect(result.metadata.extractionSuccess).toBe(true);
    expect(result.metadata.measurableDirectiveRatio).toBeGreaterThan(0.5);
    expect(result.metadata.standardReferenceCount).toBeGreaterThan(0);
  });
  
  test('should calculate low confidence for vague report', async () => {
    const reportText = `
      Some work may be needed. Various repairs should be considered.
    `;
    
    const result = await processExpertReport(reportText, MOCK_ESTIMATE, MOCK_DIMENSIONS);
    
    expect(result.expertEngineConfidence).toBeLessThan(70);
    expect(result.auditTrail.extractionWarnings).toContain(
      expect.stringContaining('confidence')
    );
  });
});

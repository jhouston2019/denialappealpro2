/**
 * ENTERPRISE HARDENING TEST SUITE
 * Tests performance, security, validation, and edge cases
 */

import { normalizeInput } from '../lib/input-normalizer';
import { detectFormat } from '../lib/format-detector';
import { parseStructuredEstimate } from '../lib/xactimate-structural-parser';
import { calculateExpectedQuantities, DimensionInput } from '../lib/dimension-engine';
import { parseReportFromText } from '../lib/report-parser';
import { calculatePerRoomDeviations } from '../lib/per-room-deviation-engine';
import { validateEstimate, validateDimensions, validatePerimeter, validateDelta, validateFileUpload } from '../lib/validation-engine';
import { sanitizeFilename, sanitizeCSV } from '../lib/security-guards';
import { extractHeightFromQuantity } from '../lib/height-extraction-engine';

interface EnterpriseTestCase {
  name: string;
  category: 'MULTI_ROOM' | 'EDGE_CASE' | 'VALIDATION' | 'SECURITY' | 'PERFORMANCE';
  estimateText: string;
  dimensions?: DimensionInput;
  reportText?: string;
  expectedOutcome: {
    shouldPass: boolean;
    shouldDetectDeviation?: boolean;
    deviationType?: string;
    minExposure?: number;
    maxExposure?: number;
    shouldThrowError?: boolean;
    errorCode?: string;
    calculationMethod?: 'PER_ROOM' | 'AGGREGATE' | 'HYBRID';
  };
}

const ENTERPRISE_TEST_CASES: EnterpriseTestCase[] = [
  
  // ========================================
  // MULTI-ROOM TESTS
  // ========================================
  
  {
    name: 'Multi-Room Mixed Cut Heights (2 rooms, different heights)',
    category: 'MULTI_ROOM',
    estimateText: `
DRY    Remove drywall 2 ft bedroom 200    SF    $400.00     $350.00
DRY    Remove drywall 4 ft living  300    SF    $600.00     $525.00
DRY    Replace drywall bedroom     200    SF    $800.00     $700.00
DRY    Replace drywall living      300    SF    $1,200.00   $1,050.00
`,
    dimensions: {
      rooms: [
        { name: 'Bedroom', length: 12, width: 12, height: 8 },
        { name: 'Living', length: 15, width: 12, height: 8 }
      ],
      sourceType: 'MANUAL'
    },
    reportText: 'Remove drywall full height on all affected walls.',
    expectedOutcome: {
      shouldPass: true,
      shouldDetectDeviation: true,
      deviationType: 'INSUFFICIENT_CUT_HEIGHT',
      calculationMethod: 'PER_ROOM',
      minExposure: 1000
    }
  },
  
  {
    name: '9ft Ceilings Throughout',
    category: 'MULTI_ROOM',
    estimateText: `DRY    Remove drywall 1/2" 2 ft    400    SF    $800.00     $700.00
DRY    Replace drywall 1/2"        400    SF    $1,600.00   $1,400.00
INS    Replace insulation R13      400    SF    $800.00     $700.00
PNT    Paint walls 2 coats         400    SF    $800.00     $700.00`,
    dimensions: {
      rooms: [
        { name: 'Living Room', length: 20, width: 15, height: 9 },
        { name: 'Kitchen', length: 12, width: 10, height: 9 }
      ],
      sourceType: 'MANUAL'
    },
    reportText: 'Remove drywall full height.',
    expectedOutcome: {
      shouldPass: true,
      shouldDetectDeviation: true,
      deviationType: 'INSUFFICIENT_CUT_HEIGHT',
      minExposure: 2000
    }
  },
  
  {
    name: '10ft Ceilings (High-End Home)',
    category: 'MULTI_ROOM',
    estimateText: `DRY    Remove drywall 1/2" 4 ft    600    SF    $1,200.00   $1,050.00
DRY    Replace drywall 1/2"        600    SF    $2,400.00   $2,100.00
INS    Replace insulation R13      600    SF    $1,200.00   $1,050.00
PNT    Paint walls 2 coats         600    SF    $1,200.00   $1,050.00`,
    dimensions: {
      rooms: [
        { name: 'Great Room', length: 25, width: 20, height: 10 },
        { name: 'Dining Room', length: 15, width: 12, height: 10 }
      ],
      sourceType: 'MANUAL'
    },
    reportText: 'Remove drywall full height.',
    expectedOutcome: {
      shouldPass: true,
      shouldDetectDeviation: true,
      deviationType: 'INSUFFICIENT_CUT_HEIGHT',
      minExposure: 3000
    }
  },
  
  {
    name: 'Partial Removal in 2 Rooms Only',
    category: 'MULTI_ROOM',
    estimateText: `
DRY    Remove drywall bedroom 1    200    SF    $400.00     $350.00
DRY    Remove drywall bedroom 2    200    SF    $400.00     $350.00
DRY    Replace drywall bedroom 1   200    SF    $800.00     $700.00
DRY    Replace drywall bedroom 2   200    SF    $800.00     $700.00
`,
    dimensions: {
      rooms: [
        { name: 'Bedroom 1', length: 12, width: 12, height: 8 },
        { name: 'Bedroom 2', length: 12, width: 10, height: 8 },
        { name: 'Living Room', length: 20, width: 15, height: 8 },
        { name: 'Kitchen', length: 12, width: 10, height: 8 }
      ],
      sourceType: 'MANUAL'
    },
    reportText: 'Remove drywall full height on all affected walls in all rooms.',
    expectedOutcome: {
      shouldPass: true,
      shouldDetectDeviation: true,
      deviationType: 'INSUFFICIENT_CUT_HEIGHT',
      calculationMethod: 'PER_ROOM'
    }
  },
  
  // ========================================
  // EDGE CASE TESTS
  // ========================================
  
  {
    name: 'Malformed CSV (Missing Columns)',
    category: 'EDGE_CASE',
    estimateText: `
DRY    Remove drywall    200
DRY    Replace drywall   200
`,
    dimensions: {
      rooms: [
        { name: 'Living Room', length: 20, width: 15, height: 8 }
      ],
      sourceType: 'MANUAL'
    },
    expectedOutcome: {
      shouldPass: false,
      shouldThrowError: true,
      errorCode: 'LOW_PARSE_CONFIDENCE'
    }
  },
  
  {
    name: 'Missing Insulation (Water Loss)',
    category: 'EDGE_CASE',
    estimateText: `DRY    Remove drywall 1/2" full    800    SF    $1,600.00   $1,400.00
DRY    Replace drywall 1/2"        800    SF    $3,200.00   $2,800.00
PNT    Paint interior walls        800    SF    $1,600.00   $1,400.00`,
    dimensions: {
      rooms: [
        { name: 'Living Room', length: 20, width: 15, height: 8 }
      ],
      sourceType: 'MANUAL'
    },
    reportText: 'Replace all insulation due to water saturation.',
    expectedOutcome: {
      shouldPass: true,
      shouldDetectDeviation: true,
      deviationType: 'DIMENSION_MISMATCH', // Will be INS dimension mismatch
      minExposure: 500
    }
  },
  
  {
    name: 'Estimate Exceeds Directive (No Height Deviation)',
    category: 'EDGE_CASE',
    estimateText: `DRY    Remove drywall walls 6 ft   420    SF    $840.00     $735.00
DRY    Replace drywall walls       420    SF    $1,680.00   $1,470.00
INS    Replace insulation R13      420    SF    $840.00     $735.00
PNT    Paint walls 2 coats         420    SF    $840.00     $735.00`,
    dimensions: {
      rooms: [
        { name: 'Living Room', length: 20, width: 15, height: 8 }
      ],
      sourceType: 'MANUAL'
    },
    reportText: 'Remove drywall 4 ft up from floor.',
    expectedOutcome: {
      shouldPass: true,
      shouldDetectDeviation: true, // Will detect dimension-based deviations (ceiling)
      deviationType: 'MISSING_CEILING' // Not INSUFFICIENT_CUT_HEIGHT
    }
  },
  
  {
    name: 'Large Commercial Building (10,000 SF)',
    category: 'EDGE_CASE',
    estimateText: `DRY    Remove drywall walls 4 ft   1600   SF    $3,200.00   $2,800.00
DRY    Replace drywall walls       1600   SF    $6,400.00   $5,600.00
INS    Replace insulation R13      1600   SF    $3,200.00   $2,800.00
PNT    Paint interior walls        1600   SF    $3,200.00   $2,800.00`,
    dimensions: {
      rooms: [
        { name: 'Warehouse Floor', length: 100, width: 100, height: 12 }
      ],
      sourceType: 'MANUAL'
    },
    reportText: 'Remove drywall full height.',
    expectedOutcome: {
      shouldPass: true,
      shouldDetectDeviation: true,
      deviationType: 'INSUFFICIENT_CUT_HEIGHT',
      minExposure: 10000
    }
  },
  
  {
    name: 'No Dimension Provided (Estimate Only)',
    category: 'EDGE_CASE',
    estimateText: `DRY    Remove drywall 1/2" 2 ft    360    SF    $720.00     $630.00
DRY    Replace drywall 1/2"        360    SF    $1,440.00   $1,260.00
PNT    Paint walls 2 coats         360    SF    $720.00     $630.00`,
    dimensions: undefined,
    reportText: undefined,
    expectedOutcome: {
      shouldPass: true,
      shouldDetectDeviation: false // No dimension or report to compare against
    }
  },
  
  {
    name: 'Zero Perimeter Edge Case',
    category: 'EDGE_CASE',
    estimateText: `
DRY    Remove drywall 1/2" 2 ft    360    SF    $720.00     $630.00
DRY    Replace drywall 1/2"        360    SF    $1,440.00   $1,260.00
`,
    dimensions: {
      rooms: [
        { name: 'Invalid Room', length: 0, width: 0, height: 8 }
      ],
      sourceType: 'MANUAL'
    },
    reportText: 'Remove drywall full height.',
    expectedOutcome: {
      shouldPass: false,
      shouldThrowError: true,
      errorCode: 'INVALID_ROOM_DIMENSIONS'
    }
  },
  
  // ========================================
  // VALIDATION TESTS
  // ========================================
  
  {
    name: 'Validation: Height Extraction from Quantity',
    category: 'VALIDATION',
    estimateText: `DRY    Remove drywall walls 4 ft   216    SF    $432.00     $378.00
DRY    Replace drywall walls       216    SF    $864.00     $756.00
PNT    Paint walls 2 coats         216    SF    $432.00     $378.00`,
    dimensions: {
      rooms: [
        { name: 'Living Room', length: 15, width: 12, height: 8 }
      ],
      sourceType: 'MANUAL'
    },
    reportText: 'Remove drywall full height.',
    expectedOutcome: {
      shouldPass: true,
      shouldDetectDeviation: true,
      deviationType: 'INSUFFICIENT_CUT_HEIGHT'
    }
  },
  
  {
    name: 'Validation: Perimeter Zero Guard',
    category: 'VALIDATION',
    estimateText: `
DRY    Remove drywall              200    SF    $400.00     $350.00
`,
    dimensions: {
      rooms: [
        { name: 'Invalid', length: 0, width: 10, height: 8 }
      ],
      sourceType: 'MANUAL'
    },
    expectedOutcome: {
      shouldPass: false,
      shouldThrowError: true,
      errorCode: 'INVALID_ROOM_DIMENSIONS'
    }
  }
];

/**
 * Run enterprise hardening tests
 */
export async function runEnterpriseHardeningTests() {
  console.log('='.repeat(80));
  console.log('ENTERPRISE HARDENING TEST SUITE');
  console.log('='.repeat(80));
  console.log('');
  
  let passed = 0;
  let failed = 0;
  const failures: string[] = [];
  
  const categories = {
    MULTI_ROOM: { passed: 0, failed: 0 },
    EDGE_CASE: { passed: 0, failed: 0 },
    VALIDATION: { passed: 0, failed: 0 },
    SECURITY: { passed: 0, failed: 0 },
    PERFORMANCE: { passed: 0, failed: 0 }
  };
  
  for (const testCase of ENTERPRISE_TEST_CASES) {
    console.log(`\n[${testCase.category}] ${testCase.name}`);
    console.log('-'.repeat(80));
    
    try {
      // Parse estimate
      const normalized = normalizeInput(testCase.estimateText, 'TEXT');
      const formatDetection = detectFormat(normalized);
      const structuredEstimate = parseStructuredEstimate(normalized, formatDetection);
      
      // Validate estimate
      const estimateValidation = validateEstimate(structuredEstimate);
      
      if (!estimateValidation.valid && testCase.expectedOutcome.shouldPass) {
        console.log(`  ✗ Estimate validation failed unexpectedly`);
        console.log(`    Errors: ${estimateValidation.errors.map(e => e.code).join(', ')}`);
        failures.push(`${testCase.name}: Estimate validation failed`);
        failed++;
        categories[testCase.category].failed++;
        continue;
      }
      
      if (!estimateValidation.valid && testCase.expectedOutcome.shouldThrowError) {
        const hasExpectedError = estimateValidation.errors.some(e => 
          e.code === testCase.expectedOutcome.errorCode
        );
        
        if (hasExpectedError) {
          console.log(`  ✓ PASS (Expected validation error: ${testCase.expectedOutcome.errorCode})`);
          passed++;
          categories[testCase.category].passed++;
          continue;
        } else {
          console.log(`  ✗ Wrong error code: ${estimateValidation.errors[0].code}`);
          failures.push(`${testCase.name}: Wrong error code`);
          failed++;
          categories[testCase.category].failed++;
          continue;
        }
      }
      
      // Calculate dimensions
      let expectedQuantities;
      if (testCase.dimensions && testCase.dimensions.rooms.length > 0) {
        const dimensionValidation = validateDimensions(testCase.dimensions);
        
        if (!dimensionValidation.valid && testCase.expectedOutcome.shouldPass) {
          console.log(`  ✗ Dimension validation failed unexpectedly`);
          console.log(`    Errors: ${dimensionValidation.errors.map(e => e.code).join(', ')}`);
          failures.push(`${testCase.name}: Dimension validation failed`);
          failed++;
          categories[testCase.category].failed++;
          continue;
        }
        
        if (!dimensionValidation.valid && testCase.expectedOutcome.shouldThrowError) {
          const hasExpectedError = dimensionValidation.errors.some(e => 
            e.code === testCase.expectedOutcome.errorCode
          );
          
          if (hasExpectedError) {
            console.log(`  ✓ PASS (Expected dimension error: ${testCase.expectedOutcome.errorCode})`);
            passed++;
            categories[testCase.category].passed++;
            continue;
          }
        }
        
        if (dimensionValidation.valid) {
          expectedQuantities = calculateExpectedQuantities(testCase.dimensions, 'FULL_HEIGHT');
        }
      }
      
      // Parse report
      let expertReport;
      if (testCase.reportText) {
        expertReport = parseReportFromText(testCase.reportText);
      }
      
      // Calculate deviations
      let deviations;
      let threwError = false;
      let errorMessage = '';
      
      try {
        deviations = calculatePerRoomDeviations(
          structuredEstimate,
          expertReport,
          expectedQuantities
        );
      } catch (error: any) {
        threwError = true;
        errorMessage = error.message;
        
        if (testCase.expectedOutcome.shouldThrowError) {
          console.log(`  ✓ PASS (Expected error thrown)`);
          console.log(`    Error: ${errorMessage}`);
          passed++;
          categories[testCase.category].passed++;
          continue;
        } else {
          console.log(`  ✗ Unexpected error: ${errorMessage}`);
          failures.push(`${testCase.name}: ${errorMessage}`);
          failed++;
          categories[testCase.category].failed++;
          continue;
        }
      }
      
      // Validate outcome
      const hasDeviation = deviations.deviations.length > 0;
      
      if (testCase.expectedOutcome.shouldDetectDeviation !== undefined) {
        if (testCase.expectedOutcome.shouldDetectDeviation !== hasDeviation) {
          console.log(`  ✗ Expected deviation: ${testCase.expectedOutcome.shouldDetectDeviation}, Got: ${hasDeviation}`);
          failures.push(`${testCase.name}: Deviation detection mismatch`);
          failed++;
          categories[testCase.category].failed++;
          continue;
        }
      }
      
      // Check deviation type
      if (testCase.expectedOutcome.deviationType && hasDeviation) {
        const hasExpectedType = deviations.deviations.some(d => 
          d.deviationType === testCase.expectedOutcome.deviationType
        );
        
        if (!hasExpectedType) {
          console.log(`  ✗ Expected deviation type: ${testCase.expectedOutcome.deviationType}`);
          console.log(`    Got: ${deviations.deviations.map(d => d.deviationType).join(', ')}`);
          failures.push(`${testCase.name}: Wrong deviation type`);
          failed++;
          categories[testCase.category].failed++;
          continue;
        }
      }
      
      // Check calculation method
      if (testCase.expectedOutcome.calculationMethod) {
        if (deviations.auditTrail.calculationMethod !== testCase.expectedOutcome.calculationMethod) {
          console.log(`  ✗ Expected calculation method: ${testCase.expectedOutcome.calculationMethod}`);
          console.log(`    Got: ${deviations.auditTrail.calculationMethod}`);
          failures.push(`${testCase.name}: Wrong calculation method`);
          failed++;
          categories[testCase.category].failed++;
          continue;
        }
      }
      
      // Check exposure
      if (testCase.expectedOutcome.minExposure) {
        if (deviations.totalDeviationExposureMin < testCase.expectedOutcome.minExposure) {
          console.log(`  ✗ Exposure too low: $${deviations.totalDeviationExposureMin} (expected min $${testCase.expectedOutcome.minExposure})`);
          failures.push(`${testCase.name}: Exposure calculation incorrect`);
          failed++;
          categories[testCase.category].failed++;
          continue;
        }
      }
      
      // Log results
      console.log(`  ✓ PASS`);
      console.log(`    Calculation Method: ${deviations.auditTrail.calculationMethod}`);
      console.log(`    Rooms: ${deviations.auditTrail.roomCount}`);
      console.log(`    Deviations: ${deviations.deviations.length}`);
      
      if (hasDeviation) {
        console.log(`    Exposure: $${deviations.totalDeviationExposureMin.toLocaleString()} - $${deviations.totalDeviationExposureMax.toLocaleString()}`);
        console.log(`    Per-Room Calculations: ${deviations.auditTrail.perRoomCalculations.length}`);
        
        for (const calc of deviations.auditTrail.perRoomCalculations) {
          console.log(`      - ${calc.roomName}: ${calc.formula}`);
        }
      }
      
      passed++;
      categories[testCase.category].passed++;
      
    } catch (error: any) {
      if (testCase.expectedOutcome.shouldThrowError) {
        console.log(`  ✓ PASS (Expected error thrown)`);
        console.log(`    Error: ${error.message}`);
        passed++;
        categories[testCase.category].passed++;
      } else {
        console.log(`  ✗ FAIL: ${error.message}`);
        failures.push(`${testCase.name}: ${error.message}`);
        failed++;
        categories[testCase.category].failed++;
      }
    }
  }
  
  // ========================================
  // UNIT TESTS (Validation Functions)
  // ========================================
  
  console.log('\n' + '='.repeat(80));
  console.log('UNIT TESTS: Validation Functions');
  console.log('='.repeat(80));
  
  // Test: validatePerimeter
  try {
    validatePerimeter(54, 'Test Room');
    console.log('  ✓ validatePerimeter: Valid perimeter accepted');
    passed++;
  } catch (error) {
    console.log('  ✗ validatePerimeter: Valid perimeter rejected');
    failed++;
    failures.push('validatePerimeter: False positive');
  }
  
  try {
    validatePerimeter(0, 'Test Room');
    console.log('  ✗ validatePerimeter: Zero perimeter not rejected');
    failed++;
    failures.push('validatePerimeter: Zero perimeter allowed');
  } catch (error) {
    console.log('  ✓ validatePerimeter: Zero perimeter rejected');
    passed++;
  }
  
  // Test: extractHeightFromQuantity
  const heightResult = extractHeightFromQuantity(432, 54, 8);
  if ('extractedHeight' in heightResult && heightResult.extractedHeight === 8) {
    console.log('  ✓ extractHeightFromQuantity: Correct calculation (432 ÷ 54 = 8)');
    passed++;
  } else {
    console.log('  ✗ extractHeightFromQuantity: Incorrect calculation');
    failed++;
    failures.push('extractHeightFromQuantity: Wrong result');
  }
  
  // Test: Height exceeds ceiling
  const heightExceedsResult = extractHeightFromQuantity(540, 54, 8);
  if ('code' in heightExceedsResult && heightExceedsResult.code === 'HEIGHT_EXCEEDS_CEILING') {
    console.log('  ✓ extractHeightFromQuantity: Height exceeds ceiling rejected');
    passed++;
  } else {
    console.log('  ✗ extractHeightFromQuantity: Height exceeds ceiling not rejected');
    failed++;
    failures.push('extractHeightFromQuantity: Did not reject excessive height');
  }
  
  // Test: sanitizeFilename
  try {
    const sanitized = sanitizeFilename('estimate.pdf');
    if (sanitized === 'estimate.pdf') {
      console.log('  ✓ sanitizeFilename: Valid filename accepted');
      passed++;
    } else {
      console.log('  ✗ sanitizeFilename: Valid filename modified incorrectly');
      failed++;
    }
  } catch (error) {
    console.log('  ✗ sanitizeFilename: Valid filename rejected');
    failed++;
  }
  
  try {
    sanitizeFilename('../../../etc/passwd');
    console.log('  ✗ sanitizeFilename: Directory traversal not rejected');
    failed++;
    failures.push('sanitizeFilename: Security vulnerability');
  } catch (error) {
    console.log('  ✓ sanitizeFilename: Directory traversal rejected');
    passed++;
  }
  
  // ========================================
  // SUMMARY
  // ========================================
  console.log('\n' + '='.repeat(80));
  console.log('ENTERPRISE HARDENING TEST SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total Tests: ${ENTERPRISE_TEST_CASES.length + 5}`); // +5 unit tests
  console.log(`Passed: ${passed} ✓`);
  console.log(`Failed: ${failed} ✗`);
  console.log(`Success Rate: ${((passed / (ENTERPRISE_TEST_CASES.length + 5)) * 100).toFixed(1)}%`);
  
  console.log('\nBy Category:');
  for (const [category, stats] of Object.entries(categories)) {
    const total = stats.passed + stats.failed;
    if (total > 0) {
      console.log(`  ${category}: ${stats.passed}/${total} passed`);
    }
  }
  
  if (failures.length > 0) {
    console.log('\nFailures:');
    for (const failure of failures) {
      console.log(`  - ${failure}`);
    }
  }
  
  console.log('='.repeat(80));
  
  return {
    passed,
    failed,
    total: ENTERPRISE_TEST_CASES.length + 5,
    failures,
    categories
  };
}

// Run if executed directly
if (require.main === module) {
  runEnterpriseHardeningTests().then(results => {
    process.exit(results.failed === 0 ? 0 : 1);
  });
}

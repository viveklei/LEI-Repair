const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  console.log('Seeding extra demo jobs for pipeline verification...');
  
  // Find or create customer
  let customer = await prisma.customer.findFirst({
    where: { companyName: 'Laser Tech Solutions Ltd' }
  });
  if (!customer) {
    customer = await prisma.customer.create({
      data: {
        companyName: 'Laser Tech Solutions Ltd',
        customerName: 'Robert Paulson',
        mobileNumber: '+919876543210',
        email: 'robert@lasertech.com',
        address: 'Industrial Area Phase 1, New Delhi, Delhi 110020',
        gstNumber: '07AAAAA1111A1Z1',
        contactPerson: 'Robert Paulson',
      }
    });
  }

  // Find engineer user
  const engineer = await prisma.user.findFirst({
    where: { email: 'engineer@fsrms.com' }
  });
  if (!engineer) {
    console.error('Engineer user not found. Run standard seed first.');
    return;
  }

  // Find accounts user
  const accountsUser = await prisma.user.findFirst({
    where: { email: 'accounts@fsrms.com' }
  });

  // Clean old demo jobs and all their related children to avoid foreign key violations
  const jobsToDelete = await prisma.serviceJob.findMany({
    where: {
      trackId: {
        in: [
          'FSR-2026-00002',
          'FSR-2026-00003',
          'FSR-2026-00004',
          'FSR-2026-00005',
          'FSR-2026-00006',
          'FSR-2026-00007',
          'FSR-2026-00008'
        ]
      }
    },
    select: { id: true }
  });
  const jobIds = jobsToDelete.map(j => j.id);

  if (jobIds.length > 0) {
    await prisma.feedback.deleteMany({ where: { jobId: { in: jobIds } } });
    await prisma.fileAttachment.deleteMany({ where: { jobId: { in: jobIds } } });
    await prisma.auditLog.deleteMany({ where: { jobId: { in: jobIds } } });
    await prisma.notification.deleteMany({ where: { jobId: { in: jobIds } } });
    await prisma.dispatch.deleteMany({ where: { jobId: { in: jobIds } } });
    await prisma.payment.deleteMany({ where: { jobId: { in: jobIds } } });
    await prisma.serviceReport.deleteMany({ where: { jobId: { in: jobIds } } });
    await prisma.testResult.deleteMany({ where: { jobId: { in: jobIds } } });
    
    // Delete repair parts junction records and repair records
    await prisma.repairSparePartUsed.deleteMany({
      where: { repair: { jobId: { in: jobIds } } }
    });
    await prisma.repair.deleteMany({ where: { jobId: { in: jobIds } } });

    // Delete quotation items and quotations
    await prisma.quotationItem.deleteMany({
      where: { quotation: { jobId: { in: jobIds } } }
    });
    await prisma.quotation.deleteMany({ where: { jobId: { in: jobIds } } });
    await prisma.inspection.deleteMany({ where: { jobId: { in: jobIds } } });

    // Finally delete the jobs
    await prisma.serviceJob.deleteMany({ where: { id: { in: jobIds } } });
  }

  // Helper to upsert LaserSource
  const getLaser = async (brand, serial, model, power) => {
    let laser = await prisma.laserSource.findUnique({ where: { serialNumber: serial } });
    if (!laser) {
      laser = await prisma.laserSource.create({
        data: {
          brand,
          serialNumber: serial,
          modelNumber: model,
          powerRating: power,
          mfgYear: 2024,
          sourceType: 'Single Module'
        }
      });
    }
    return laser;
  };

  // 1. Job in RECEIVED status
  const laser1 = await getLaser('IPG', 'IPG-20A918', 'YLR-1000', '1kW');
  await prisma.serviceJob.create({
    data: {
      trackId: 'FSR-2026-00002',
      customerId: customer.id,
      laserSourceId: laser1.id,
      complaintCategory: 'Fiber Break',
      complaintDescription: 'Fiber cable outer armor damaged near high-power combiners. No output.',
      status: 'RECEIVED',
    }
  });

  // 2. Job in INITIAL_DIAGNOSIS (Inspected)
  const laser2 = await getLaser('JPT', 'JPT-CLAD-991', 'JPT-YDFLP', '2kW');
  const job2 = await prisma.serviceJob.create({
    data: {
      trackId: 'FSR-2026-00003',
      customerId: customer.id,
      laserSourceId: laser2.id,
      complaintCategory: 'Alarm Error',
      complaintDescription: 'Coolant temperature alarm E04 flashes upon startup.',
      status: 'INITIAL_DIAGNOSIS',
    }
  });
  await prisma.inspection.create({
    data: {
      jobId: job2.id,
      engineerId: engineer.id,
      physicalCondition: 'Good condition overall, minor dust around cooling ports.',
      internalFindings: 'Deionized water lines have scale accumulation, restricting flow.',
      faultAnalysis: 'Water jacket blockage near high power pumping diode stack.',
      initialDiagnosis: 'Needs descaling sweep and flow sensor verification.',
      inspectionNotes: 'Water cooling loop must be descaled with chemical solution.'
    }
  });

  // 3. Job in QUOTATION_GENERATED (Pending Approval)
  const laser3 = await getLaser('Maxphotonics', 'MAX-6KW-8812', 'MAX-C6000', '6kW');
  const job3 = await prisma.serviceJob.create({
    data: {
      trackId: 'FSR-2026-00004',
      customerId: customer.id,
      laserSourceId: laser3.id,
      complaintCategory: 'QBH Damage',
      complaintDescription: 'Output collimator quartz end-cap burned. QBH ring melted.',
      status: 'QUOTATION_GENERATED',
    }
  });
  await prisma.inspection.create({
    data: {
      jobId: job3.id,
      engineerId: engineer.id,
      physicalCondition: 'QBH outer connector rings show heat discoloration.',
      internalFindings: 'Collimator lens burned. Optical feedback sensor shows backscattering.',
      faultAnalysis: 'QBH optical coating breakdown caused high heat backscattering.',
      initialDiagnosis: 'QBH assembly and collimator lens need full replacement.',
      inspectionNotes: 'Requires cleanroom assembly.'
    }
  });
  // Create pending quote
  await prisma.quotation.create({
    data: {
      jobId: job3.id,
      creatorId: accountsUser ? accountsUser.id : engineer.id,
      status: 'PENDING_APPROVAL',
      totalParts: 45000,
      totalConsumables: 5000,
      totalLabour: 8000,
      grandTotal: 58000,
      items: {
        create: [
          { name: 'QBH Connector Assembly', category: 'SPARE_PART', quantity: 1, unitCost: 45000, totalCost: 45000 },
          { name: 'Deionized water filters', category: 'CONSUMABLE', quantity: 2, unitCost: 2500, totalCost: 5000 },
          { name: 'Laser module re-alignment labor', category: 'LABOUR', quantity: 1, unitCost: 8000, totalCost: 8000 }
        ]
      }
    }
  });

  // 4. Job in UNDER_REPAIR (Repair Started)
  const laser4 = await getLaser('Raycus', 'RAY-3KW-5511', 'RFL-C3000S', '3kW');
  const job4 = await prisma.serviceJob.create({
    data: {
      trackId: 'FSR-2026-00005',
      customerId: customer.id,
      laserSourceId: laser4.id,
      complaintCategory: 'Module Failure',
      complaintDescription: 'Diode current rises to 80A but optical power does not exceed 500W.',
      status: 'UNDER_REPAIR',
    }
  });
  await prisma.inspection.create({
    data: {
      jobId: job4.id,
      engineerId: engineer.id,
      physicalCondition: 'Dusty, fan guards clogged.',
      internalFindings: 'Pump diode modules 2 and 4 show open circuit voltage.',
      faultAnalysis: 'Two pump diode packages failed due to electrical surge.',
      initialDiagnosis: 'Replace failed pump diode packages.',
      inspectionNotes: 'Check control board diode driver gating pulses.'
    }
  });
  await prisma.quotation.create({
    data: {
      jobId: job4.id,
      creatorId: accountsUser ? accountsUser.id : engineer.id,
      status: 'APPROVED',
      totalParts: 24000,
      totalConsumables: 2000,
      totalLabour: 4000,
      grandTotal: 30000,
      items: {
        create: [
          { name: 'Pump Diode (Raycus 135W)', category: 'SPARE_PART', quantity: 2, unitCost: 12000, totalCost: 24000 },
          { name: 'Thermal interface paste', category: 'CONSUMABLE', quantity: 1, unitCost: 2000, totalCost: 2000 },
          { name: 'Diode mounting labor', category: 'LABOUR', quantity: 1, unitCost: 4000, totalCost: 4000 }
        ]
      }
    }
  });

  // 5. Job in TESTING_BURN_IN
  const laser5 = await getLaser('IPG', 'IPG-500W-002', 'YLR-500', '500W');
  const job5 = await prisma.serviceJob.create({
    data: {
      trackId: 'FSR-2026-00006',
      customerId: customer.id,
      laserSourceId: laser5.id,
      complaintCategory: 'No Laser Output',
      complaintDescription: 'System turns on but interlock alarm indicates open loop. No guide beam.',
      status: 'TESTING_BURN_IN',
    }
  });
  await prisma.inspection.create({
    data: {
      jobId: job5.id,
      engineerId: engineer.id,
      physicalCondition: 'Clean connector, good housing.',
      internalFindings: 'Interlock circuit loop wire loose on PCB connector.',
      faultAnalysis: 'Mechanical vibration loosened control pins.',
      initialDiagnosis: 'Solder interlock trace and pin locks.',
      inspectionNotes: 'Check continuity.'
    }
  });
  await prisma.quotation.create({
    data: {
      jobId: job5.id,
      creatorId: accountsUser ? accountsUser.id : engineer.id,
      status: 'APPROVED',
      totalParts: 0,
      totalConsumables: 500,
      totalLabour: 2000,
      grandTotal: 2500,
      items: {
        create: [
          { name: 'Solder wire and flux', category: 'CONSUMABLE', quantity: 1, unitCost: 500, totalCost: 500 },
          { name: 'PCB soldering labor', category: 'LABOUR', quantity: 1, unitCost: 2000, totalCost: 2000 }
        ]
      }
    }
  });
  await prisma.repair.create({
    data: {
      jobId: job5.id,
      engineerId: engineer.id,
      repairNotes: 'Soldered interlock pin locks and checked loop continuity. Active guide beam restored.',
      repairDuration: 45,
      startStatus: 'REPAIR_INITIATED',
      endStatus: 'UNDER_REPAIR'
    }
  });

  // 6. Job in READY_FOR_DISPATCH
  const laser6 = await getLaser('JPT', 'JPT-MOPA-441', 'JPT-M7-100', '100W');
  const job6 = await prisma.serviceJob.create({
    data: {
      trackId: 'FSR-2026-00007',
      customerId: customer.id,
      laserSourceId: laser6.id,
      complaintCategory: 'Beam Quality Issue',
      complaintDescription: 'Pulse frequency fluctuations degrade marked lines edge quality.',
      status: 'READY_FOR_DISPATCH',
    }
  });
  await prisma.inspection.create({
    data: {
      jobId: job6.id,
      engineerId: engineer.id,
      physicalCondition: 'Good condition.',
      internalFindings: 'Galvanic isolator optocouplers on PCB driver board have degraded resistance.',
      faultAnalysis: 'Aged optocoupler chip caused clock signal skew at frequencies >200kHz.',
      initialDiagnosis: 'Replace PCB driver control optocouplers.',
      inspectionNotes: 'Scope frequency response.'
    }
  });
  await prisma.quotation.create({
    data: {
      jobId: job6.id,
      creatorId: accountsUser ? accountsUser.id : engineer.id,
      status: 'APPROVED',
      totalParts: 3500,
      totalConsumables: 500,
      totalLabour: 3000,
      grandTotal: 7000,
      items: {
        create: [
          { name: 'Optocoupler High Speed IC', category: 'SPARE_PART', quantity: 2, unitCost: 1750, totalCost: 3500 },
          { name: 'Solder flux & cleaner', category: 'CONSUMABLE', quantity: 1, unitCost: 500, totalCost: 500 },
          { name: 'Micro SMD soldering labor', category: 'LABOUR', quantity: 1, unitCost: 3000, totalCost: 3000 }
        ]
      }
    }
  });
  await prisma.repair.create({
    data: {
      jobId: job6.id,
      engineerId: engineer.id,
      repairNotes: 'SMD soldered high speed optocouplers on controller board. Output frequency waveforms tested stable.',
      repairDuration: 90,
      startStatus: 'REPAIR_INITIATED',
      endStatus: 'UNDER_REPAIR'
    }
  });
  await prisma.testResult.create({
    data: {
      jobId: job6.id,
      engineerId: engineer.id,
      outputPowerTest: 'PASS - Stable 102W average output',
      stabilityTest: 'PASS - Less than 0.5% variance over 1 hour',
      burnInTest: 'PASS - 2 hour MOPA pulse cycle stress test passed',
      alarmVerification: 'PASS - All system diagnostics clean',
      temperatureTest: 'PASS - Nominal core temp 23.2C',
      communicationTest: 'PASS - DB25 gating signal operational',
      testNotes: 'Pulses edge timing measured normal down to 10ns.',
      result: 'PASS'
    }
  });

  // 7. Job in DISPATCHED
  const laser7 = await getLaser('Maxphotonics', 'MAX-2KW-3312', 'MAX-C2000', '2kW');
  const job7 = await prisma.serviceJob.create({
    data: {
      trackId: 'FSR-2026-00008',
      customerId: customer.id,
      laserSourceId: laser7.id,
      complaintCategory: 'Water Leakage',
      complaintDescription: 'Deionized water leaking near output collimator boot seal.',
      status: 'DISPATCHED',
      paymentStatus: 'PAID'
    }
  });
  // Quote
  await prisma.quotation.create({
    data: {
      jobId: job7.id,
      creatorId: accountsUser ? accountsUser.id : engineer.id,
      status: 'APPROVED',
      totalParts: 1500,
      totalConsumables: 500,
      totalLabour: 2000,
      grandTotal: 4000,
      items: {
        create: [
          { name: 'Water hose O-rings and gasket set', category: 'SPARE_PART', quantity: 1, unitCost: 1500, totalCost: 1500 },
          { name: 'Sealing paste', category: 'CONSUMABLE', quantity: 1, unitCost: 500, totalCost: 500 },
          { name: 'Hose replacement labor', category: 'LABOUR', quantity: 1, unitCost: 2000, totalCost: 2000 }
        ]
      }
    }
  });
  // Test
  await prisma.testResult.create({
    data: {
      jobId: job7.id,
      engineerId: engineer.id,
      outputPowerTest: 'PASS - 2.05kW output power stable',
      stabilityTest: 'PASS - Nominal power ripple <0.8%',
      burnInTest: 'PASS - 2 hour run checked clean',
      alarmVerification: 'PASS - Pressure switch closed',
      temperatureTest: 'PASS - Stable chiller coolant flow',
      communicationTest: 'PASS - Comm locks active',
      result: 'PASS'
    }
  });
  // Service Report
  await prisma.serviceReport.create({
    data: {
      jobId: job7.id,
      engineerId: engineer.id,
      faultFound: 'Output collimator water seal gasket degraded.',
      rootCauseAnalysis: 'Age-related thermal stress on standard silicone water ring.',
      repairActions: 'Replaced coolant seals with high temperature Viton water gaskets.',
      finalOutcome: 'Cooling loop pressurized to 5 bar with zero leakages. Output stable.',
      signatureData: 'data:image/png;base64,i...=='
    }
  });
  // Payment
  await prisma.payment.create({
    data: {
      jobId: job7.id,
      invoiceNumber: 'INV-2026-0002',
      invoiceDate: new Date(),
      invoiceAmount: 4000,
      paidAmount: 4000,
      dueAmount: 0,
      status: 'PAID'
    }
  });
  // Dispatch
  await prisma.dispatch.create({
    data: {
      jobId: job7.id,
      courierName: 'Blue Dart Express',
      awbNumber: '881299831',
      deliveryStatus: 'IN_TRANSIT'
    }
  });

  console.log('✓ Successfully seeded extra jobs in different statuses.');
  await prisma.$disconnect();
}

run().catch(console.error);

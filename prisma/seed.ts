import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('开始播种数据...');

  const hashedPassword = await bcrypt.hash('123456', 12);

  console.log('1/7: 创建用户...');
  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      passwordHash: hashedPassword,
      fullName: '系统管理员',
      role: 'ADMIN',
      phone: '13800138000',
      email: 'admin@emergency.com',
    },
  });

  const dispatcher = await prisma.user.upsert({
    where: { username: 'dispatcher' },
    update: {},
    create: {
      username: 'dispatcher',
      passwordHash: hashedPassword,
      fullName: '张调度',
      role: 'DISPATCHER',
      phone: '13800138001',
      email: 'dispatcher@emergency.com',
    },
  });

  const paramedic1 = await prisma.user.upsert({
    where: { username: 'paramedic1' },
    update: {},
    create: {
      username: 'paramedic1',
      passwordHash: hashedPassword,
      fullName: '李急救',
      role: 'PARAMEDIC',
      phone: '13800138002',
      email: 'paramedic1@emergency.com',
    },
  });

  const paramedic2 = await prisma.user.upsert({
    where: { username: 'paramedic2' },
    update: {},
    create: {
      username: 'paramedic2',
      passwordHash: hashedPassword,
      fullName: '王医生',
      role: 'PARAMEDIC',
      phone: '13800138003',
      email: 'paramedic2@emergency.com',
    },
  });

  const doctor1 = await prisma.user.upsert({
    where: { username: 'doctor1' },
    update: {},
    create: {
      username: 'doctor1',
      passwordHash: hashedPassword,
      fullName: '赵主任',
      role: 'DOCTOR',
      phone: '13800138004',
      email: 'doctor1@hospital.com',
      department: '急诊科',
    },
  });

  const hospitalStaff = await prisma.user.upsert({
    where: { username: 'hospstaff' },
    update: {},
    create: {
      username: 'hospstaff',
      passwordHash: hashedPassword,
      fullName: '孙护士',
      role: 'HOSPITAL_STAFF',
      phone: '13800138005',
      email: 'staff@hospital.com',
      department: '急诊科',
    },
  });

  console.log('2/7: 创建急救站...');
  const station1 = await prisma.emergencyStation.upsert({
    where: { code: 'ST001' },
    update: {},
    create: {
      name: '市中心急救站',
      code: 'ST001',
      address: '市中心区人民路1号',
      latitude: 39.9042,
      longitude: 116.4074,
      contactPhone: '120-001',
    },
  });

  const station2 = await prisma.emergencyStation.upsert({
    where: { code: 'ST002' },
    update: {},
    create: {
      name: '北区急救站',
      code: 'ST002',
      address: '北区建设路88号',
      latitude: 39.9542,
      longitude: 116.4074,
      contactPhone: '120-002',
    },
  });

  console.log('3/7: 创建急救小组...');
  const team1 = await prisma.emergencyTeam.upsert({
    where: { code: 'TM001' },
    update: {},
    create: {
      name: '急救一组',
      code: 'TM001',
      stationId: station1.id,
    },
  });

  const team2 = await prisma.emergencyTeam.upsert({
    where: { code: 'TM002' },
    update: {},
    create: {
      name: '急救二组',
      code: 'TM002',
      stationId: station1.id,
    },
  });

  await prisma.user.update({ where: { id: dispatcher.id }, data: { stationId: station1.id } });
  await prisma.user.update({ where: { id: paramedic1.id }, data: { stationId: station1.id, teamId: team1.id } });
  await prisma.user.update({ where: { id: paramedic2.id }, data: { stationId: station1.id, teamId: team1.id } });

  console.log('4/7: 创建车辆...');
  const vehicle1 = await prisma.vehicle.upsert({
    where: { plateNumber: '京A12001' },
    update: {},
    create: {
      plateNumber: '京A12001',
      vehicleType: '监护型救护车',
      status: 'AVAILABLE',
      stationId: station1.id,
      currentTeamId: team1.id,
      currentLatitude: station1.latitude,
      currentLongitude: station1.longitude,
      fuelLevel: 85,
    },
  });

  const vehicle2 = await prisma.vehicle.upsert({
    where: { plateNumber: '京A12002' },
    update: {},
    create: {
      plateNumber: '京A12002',
      vehicleType: '抢救型救护车',
      status: 'AVAILABLE',
      stationId: station1.id,
      currentTeamId: team2.id,
      currentLatitude: station1.latitude,
      currentLongitude: station1.longitude,
      fuelLevel: 92,
    },
  });

  const vehicle3 = await prisma.vehicle.upsert({
    where: { plateNumber: '京B12001' },
    update: {},
    create: {
      plateNumber: '京B12001',
      vehicleType: '监护型救护车',
      status: 'AVAILABLE',
      stationId: station2.id,
      currentLatitude: station2.latitude,
      currentLongitude: station2.longitude,
      fuelLevel: 78,
    },
  });

  console.log('5/7: 创建医院...');
  const hospital1 = await prisma.hospital.upsert({
    where: { id: 'hosp1' },
    update: {},
    create: {
      id: 'hosp1',
      name: '市中心医院',
      address: '市中心区健康路100号',
      latitude: 39.9142,
      longitude: 116.4274,
      contactPhone: '010-88888888',
      hasER: true,
      erBedsTotal: 30,
      erBedsOccupied: 12,
      erDoctorsOnDuty: 5,
      erLoadLevel: 0.4,
      specialties: JSON.stringify(['cardiology', 'neurology', 'emergency', 'trauma', 'surgery']),
    },
  });

  const hospital2 = await prisma.hospital.upsert({
    where: { id: 'hosp2' },
    update: {},
    create: {
      id: 'hosp2',
      name: '第一人民医院',
      address: '东区人民大道200号',
      latitude: 39.9092,
      longitude: 116.4874,
      contactPhone: '010-66666666',
      hasER: true,
      erBedsTotal: 25,
      erBedsOccupied: 18,
      erDoctorsOnDuty: 4,
      erLoadLevel: 0.72,
      specialties: JSON.stringify(['cardiology', 'emergency', 'pediatrics', 'respiration']),
    },
  });

  const hospital3 = await prisma.hospital.upsert({
    where: { id: 'hosp3' },
    update: {},
    create: {
      id: 'hosp3',
      name: '心脑血管专科医院',
      address: '北区医学院路50号',
      latitude: 39.9642,
      longitude: 116.3974,
      contactPhone: '010-55555555',
      hasER: true,
      erBedsTotal: 20,
      erBedsOccupied: 8,
      erDoctorsOnDuty: 6,
      erLoadLevel: 0.4,
      specialties: JSON.stringify(['cardiology', 'neurology']),
    },
  });

  await prisma.user.update({ where: { id: doctor1.id }, data: { hospitalId: hospital1.id } });
  await prisma.user.update({ where: { id: hospitalStaff.id }, data: { hospitalId: hospital1.id } });

  const depts = [
    { hospitalId: hospital1.id, name: '急诊科', contactPhone: '010-88888001', available: true },
    { hospitalId: hospital1.id, name: '心内科', contactPhone: '010-88888002', available: true },
    { hospitalId: hospital1.id, name: '神经内科', contactPhone: '010-88888003', available: true },
    { hospitalId: hospital1.id, name: '创伤外科', contactPhone: '010-88888004', available: true },
    { hospitalId: hospital2.id, name: '急诊科', contactPhone: '010-66666001', available: true },
    { hospitalId: hospital2.id, name: '儿科急诊', contactPhone: '010-66666002', available: true },
    { hospitalId: hospital3.id, name: '急诊介入中心', contactPhone: '010-55555001', available: true },
    { hospitalId: hospital3.id, name: '脑卒中中心', contactPhone: '010-55555002', available: true },
  ];
  for (const d of depts) {
    const existing = await prisma.hospitalDepartment.findFirst({
      where: { hospitalId: d.hospitalId, name: d.name },
    });
    if (!existing) await prisma.hospitalDepartment.create({ data: d as any });
  }

  console.log('6/7: 创建医疗物资...');
  const supplies = [
    { name: '肾上腺素注射液', category: '急救药品', unit: '支', safetyStock: 10, defaultQuantityPerVehicle: 20 },
    { name: '阿托品注射液', category: '急救药品', unit: '支', safetyStock: 10, defaultQuantityPerVehicle: 15 },
    { name: '硝酸甘油片', category: '急救药品', unit: '瓶', safetyStock: 5, defaultQuantityPerVehicle: 10 },
    { name: '速效救心丸', category: '急救药品', unit: '盒', safetyStock: 5, defaultQuantityPerVehicle: 10 },
    { name: '生理盐水', category: '输液药品', unit: '袋', safetyStock: 10, defaultQuantityPerVehicle: 20 },
    { name: '葡萄糖注射液', category: '输液药品', unit: '袋', safetyStock: 10, defaultQuantityPerVehicle: 15 },
    { name: '一次性注射器5ml', category: '耗材', unit: '支', safetyStock: 20, defaultQuantityPerVehicle: 50 },
    { name: '一次性输液器', category: '耗材', unit: '套', safetyStock: 10, defaultQuantityPerVehicle: 30 },
    { name: '医用纱布', category: '耗材', unit: '包', safetyStock: 10, defaultQuantityPerVehicle: 30 },
    { name: '医用绷带', category: '耗材', unit: '卷', safetyStock: 10, defaultQuantityPerVehicle: 20 },
    { name: '止血带', category: '耗材', unit: '根', safetyStock: 5, defaultQuantityPerVehicle: 10 },
    { name: '医用口罩', category: '防护用品', unit: '个', safetyStock: 50, defaultQuantityPerVehicle: 100 },
    { name: '一次性手套', category: '防护用品', unit: '副', safetyStock: 20, defaultQuantityPerVehicle: 50 },
  ];

  for (const s of supplies) {
    await prisma.medicalSupply.upsert({
      where: { name: s.name },
      update: {},
      create: s,
    });
  }

  console.log('7/7: 分配车辆物资库存...');
  const allSupplies = await prisma.medicalSupply.findMany();
  const allVehicles = await prisma.vehicle.findMany();

  for (const vehicle of allVehicles) {
    for (const supply of allSupplies) {
      await prisma.vehicleSupply.upsert({
        where: {
          vehicleId_supplyId: {
            vehicleId: vehicle.id,
            supplyId: supply.id,
          },
        },
        update: {},
        create: {
          vehicleId: vehicle.id,
          supplyId: supply.id,
          quantity: supply.defaultQuantityPerVehicle,
          lastRefilledAt: new Date(),
        },
      });
    }
  }

  console.log(`
╔═══════════════════════════════════════════════════════╗
║               ✅ 数据播种完成！                         ║
╠═══════════════════════════════════════════════════════╣
║                                                       ║
║  测试账户（密码均为 123456）：                          ║
║  ┌─────────────────────────────────────────────────┐  ║
║  │  admin         → 系统管理员 (全部权限)           │  ║
║  │  dispatcher    → 张调度 (接警派单)               │  ║
║  │  paramedic1    → 李急救 (出车处置)               │  ║
║  │  paramedic2    → 王医生 (出车处置)               │  ║
║  │  doctor1       → 赵主任 (接收预警/病历)          │  ║
║  │  hospstaff     → 孙护士 (更新医院负荷)           │  ║
║  └─────────────────────────────────────────────────┘  ║
║                                                       ║
║  已创建数据：                                           ║
║    • 用户: 6个                                         ║
║    • 急救站: 2个                                       ║
║    • 急救小组: 2个                                     ║
║    • 救护车: 3辆                                       ║
║    • 医院: 3家（含8个科室）                            ║
║    • 医疗物资: 13种                                    ║
║    • 车辆物资库存: 39条                                ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
  `);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

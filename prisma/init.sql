-- =====================================================================
-- 智慧急救中心院前调度与院内联动系统
-- PostgreSQL 建表脚本 (无需 Prisma 迁移时可直接执行)
-- =====================================================================

-- 创建数据库 (需要先在 PostgreSQL 中执行)
-- CREATE DATABASE emergency_db;

-- 切换到 emergency_db 数据库后执行以下脚本

-- =====================================================================
-- 枚举类型
-- =====================================================================
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'DISPATCHER', 'PARAMEDIC', 'DOCTOR', 'HOSPITAL_STAFF');
CREATE TYPE "VehicleStatus" AS ENUM ('AVAILABLE', 'ON_CALL', 'ON_ROUTE', 'AT_SCENE', 'TRANSPORTING', 'AT_HOSPITAL', 'RETURNING', 'MAINTENANCE', 'OUT_OF_SERVICE');
CREATE TYPE "EmergencyLevel" AS ENUM ('CRITICAL', 'SEVERE', 'MODERATE', 'MINOR');
CREATE TYPE "DispatchStatus" AS ENUM ('PENDING', 'ASSIGNED', 'ACCEPTED', 'EN_ROUTE_TO_SCENE', 'AT_SCENE', 'EN_ROUTE_TO_HOSPITAL', 'AT_HOSPITAL', 'COMPLETED', 'CANCELLED');
CREATE TYPE "AlertSeverity" AS ENUM ('CRITICAL', 'WARNING', 'INFO');
CREATE TYPE "AlertStatus" AS ENUM ('PENDING', 'ACKNOWLEDGED', 'RESOLVED');
CREATE TYPE "SupplyRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'FULFILLED');

-- =====================================================================
-- 用户表
-- =====================================================================
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "stationId" TEXT,
    "teamId" TEXT,
    "hospitalId" TEXT,
    "department" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- =====================================================================
-- 急救站表
-- =====================================================================
CREATE TABLE "EmergencyStation" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "contactPhone" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmergencyStation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EmergencyStation_code_key" ON "EmergencyStation"("code");

-- =====================================================================
-- 急救小组表
-- =====================================================================
CREATE TABLE "EmergencyTeam" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "stationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmergencyTeam_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EmergencyTeam_code_key" ON "EmergencyTeam"("code");

-- =====================================================================
-- 急救车辆表
-- =====================================================================
CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL,
    "plateNumber" TEXT NOT NULL,
    "vehicleType" TEXT NOT NULL,
    "status" "VehicleStatus" NOT NULL DEFAULT 'AVAILABLE',
    "stationId" TEXT NOT NULL,
    "currentTeamId" TEXT,
    "currentLatitude" DOUBLE PRECISION,
    "currentLongitude" DOUBLE PRECISION,
    "lastLocationUpdate" TIMESTAMP(3),
    "currentDispatchId" TEXT,
    "fuelLevel" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Vehicle_plateNumber_key" ON "Vehicle"("plateNumber");

-- =====================================================================
-- 医院表
-- =====================================================================
CREATE TABLE "Hospital" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "contactPhone" TEXT NOT NULL,
    "hasER" BOOLEAN NOT NULL DEFAULT true,
    "erBedsTotal" INTEGER NOT NULL DEFAULT 0,
    "erBedsOccupied" INTEGER NOT NULL DEFAULT 0,
    "erDoctorsOnDuty" INTEGER NOT NULL DEFAULT 0,
    "erLoadLevel" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastLoadUpdate" TIMESTAMP(3),
    "specialties" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Hospital_pkey" PRIMARY KEY ("id")
);

-- =====================================================================
-- 医院科室表
-- =====================================================================
CREATE TABLE "HospitalDepartment" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactPhone" TEXT,
    "available" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HospitalDepartment_pkey" PRIMARY KEY ("id")
);

-- =====================================================================
-- 接警记录表
-- =====================================================================
CREATE TABLE "EmergencyCall" (
    "id" TEXT NOT NULL,
    "callNumber" TEXT NOT NULL,
    "callerName" TEXT,
    "callerPhone" TEXT NOT NULL,
    "patientName" TEXT,
    "patientAge" INTEGER,
    "patientGender" TEXT,
    "locationAddress" TEXT NOT NULL,
    "locationLatitude" DOUBLE PRECISION NOT NULL,
    "locationLongitude" DOUBLE PRECISION NOT NULL,
    "chiefComplaint" TEXT NOT NULL,
    "symptoms" TEXT[],
    "emergencyLevel" "EmergencyLevel" NOT NULL,
    "callTime" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmergencyCall_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EmergencyCall_callNumber_key" ON "EmergencyCall"("callNumber");

-- =====================================================================
-- 派单表
-- =====================================================================
CREATE TABLE "Dispatch" (
    "id" TEXT NOT NULL,
    "callId" TEXT NOT NULL,
    "status" "DispatchStatus" NOT NULL DEFAULT 'PENDING',
    "level" "EmergencyLevel" NOT NULL,
    "dispatcherId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "assignedTeamId" TEXT,
    "assignedDoctorId" TEXT,
    "acceptedAt" TIMESTAMP(3),
    "enRouteAt" TIMESTAMP(3),
    "sceneArrivalAt" TIMESTAMP(3),
    "hospitalDepartAt" TIMESTAMP(3),
    "hospitalArrivalAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "handoverTime" TIMESTAMP(3),
    "recommendedHospitalId" TEXT,
    "actualHospitalId" TEXT,
    "dispatchNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Dispatch_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Dispatch_callId_key" ON "Dispatch"("callId");

-- =====================================================================
-- 患者表
-- =====================================================================
CREATE TABLE "Patient" (
    "id" TEXT NOT NULL,
    "callId" TEXT NOT NULL,
    "dispatchId" TEXT,
    "fullName" TEXT,
    "age" INTEGER,
    "gender" TEXT,
    "idNumber" TEXT,
    "contactPhone" TEXT,
    "medicalHistory" TEXT,
    "allergies" TEXT,
    "currentMedications" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Patient_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Patient_callId_key" ON "Patient"("callId");
CREATE UNIQUE INDEX "Patient_dispatchId_key" ON "Patient"("dispatchId");

-- =====================================================================
-- 生命体征表
-- =====================================================================
CREATE TABLE "VitalSign" (
    "id" TEXT NOT NULL,
    "dispatchId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "heartRate" INTEGER,
    "systolicBP" INTEGER,
    "diastolicBP" INTEGER,
    "oxygenSaturation" DOUBLE PRECISION,
    "respiratoryRate" INTEGER,
    "temperature" DOUBLE PRECISION,
    "ecgData" TEXT,
    "consciousness" TEXT,
    "isAbnormal" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VitalSign_pkey" PRIMARY KEY ("id")
);

-- =====================================================================
-- 预警表
-- =====================================================================
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" "AlertSeverity" NOT NULL,
    "status" "AlertStatus" NOT NULL DEFAULT 'PENDING',
    "dispatchId" TEXT,
    "vitalSignId" TEXT,
    "message" TEXT NOT NULL,
    "diagnosisSuggestion" TEXT,
    "acknowledgedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- =====================================================================
-- 预警接收人表
-- =====================================================================
CREATE TABLE "AlertRecipient" (
    "id" TEXT NOT NULL,
    "alertId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "notifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlertRecipient_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AlertRecipient_alertId_userId_key" ON "AlertRecipient"("alertId", "userId");

-- =====================================================================
-- 院前急救电子病历表
-- =====================================================================
CREATE TABLE "MedicalRecord" (
    "id" TEXT NOT NULL,
    "dispatchId" TEXT NOT NULL,
    "patientId" TEXT,
    "chiefComplaint" TEXT NOT NULL,
    "historyOfPresentIllness" TEXT,
    "physicalExamination" TEXT,
    "vitalSignsSummary" TEXT,
    "fieldDiagnosis" TEXT NOT NULL,
    "treatmentProvided" TEXT NOT NULL,
    "medicationsGiven" TEXT,
    "proceduresPerformed" TEXT,
    "patientConditionAtHandover" TEXT NOT NULL,
    "handoverToHospitalStaff" TEXT NOT NULL,
    "handoverStaffName" TEXT NOT NULL,
    "syncedToHospital" BOOLEAN NOT NULL DEFAULT false,
    "syncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MedicalRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MedicalRecord_dispatchId_key" ON "MedicalRecord"("dispatchId");

-- =====================================================================
-- 医疗物资表
-- =====================================================================
CREATE TABLE "MedicalSupply" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "safetyStock" DOUBLE PRECISION NOT NULL,
    "defaultQuantityPerVehicle" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MedicalSupply_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MedicalSupply_name_key" ON "MedicalSupply"("name");

-- =====================================================================
-- 车辆物资库存表
-- =====================================================================
CREATE TABLE "VehicleSupply" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "supplyId" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "lastRefilledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehicleSupply_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VehicleSupply_vehicleId_supplyId_key" ON "VehicleSupply"("vehicleId", "supplyId");

-- =====================================================================
-- 派单物资消耗表
-- =====================================================================
CREATE TABLE "DispatchSupplyUsage" (
    "id" TEXT NOT NULL,
    "dispatchId" TEXT NOT NULL,
    "supplyId" TEXT NOT NULL,
    "quantityUsed" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DispatchSupplyUsage_pkey" PRIMARY KEY ("id")
);

-- =====================================================================
-- 物资补充申请表
-- =====================================================================
CREATE TABLE "SupplyRequest" (
    "id" TEXT NOT NULL,
    "requestNumber" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "status" "SupplyRequestStatus" NOT NULL DEFAULT 'PENDING',
    "priority" TEXT NOT NULL,
    "notes" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "fulfilledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplyRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SupplyRequest_requestNumber_key" ON "SupplyRequest"("requestNumber");

-- =====================================================================
-- 物资补充申请明细表
-- =====================================================================
CREATE TABLE "SupplyRequestItem" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "supplyId" TEXT NOT NULL,
    "requestedQuantity" DOUBLE PRECISION NOT NULL,
    "fulfilledQuantity" DOUBLE PRECISION,

    CONSTRAINT "SupplyRequestItem_pkey" PRIMARY KEY ("id")
);

-- =====================================================================
-- 急救质量报告表
-- =====================================================================
CREATE TABLE "QualityReport" (
    "id" TEXT NOT NULL,
    "reportMonth" TEXT NOT NULL,
    "stationId" TEXT,
    "teamId" TEXT,
    "totalCalls" INTEGER NOT NULL DEFAULT 0,
    "avgResponseTime" DOUBLE PRECISION NOT NULL,
    "avgSceneTime" DOUBLE PRECISION NOT NULL,
    "hospitalDecisionAccuracy" DOUBLE PRECISION NOT NULL,
    "criticalResponseWithinTarget" DOUBLE PRECISION NOT NULL,
    "onTimeDelivery" DOUBLE PRECISION NOT NULL,
    "data" JSONB NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "exportedAt" TIMESTAMP(3),

    CONSTRAINT "QualityReport_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "QualityReport_reportMonth_stationId_teamId_key" ON "QualityReport"("reportMonth", "stationId", "teamId");

-- =====================================================================
-- 系统通知表
-- =====================================================================
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "recipientRole" "UserRole",
    "recipientUserId" TEXT,
    "dispatchId" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- =====================================================================
-- 外键约束
-- =====================================================================
ALTER TABLE "Dispatch" ADD CONSTRAINT "Dispatch_dispatcherId_fkey" FOREIGN KEY ("dispatcherId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Dispatch" ADD CONSTRAINT "Dispatch_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Dispatch" ADD CONSTRAINT "Dispatch_callId_fkey" FOREIGN KEY ("callId") REFERENCES "EmergencyCall"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Dispatch" ADD CONSTRAINT "Dispatch_assignedTeamId_fkey" FOREIGN KEY ("assignedTeamId") REFERENCES "EmergencyTeam"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Dispatch" ADD CONSTRAINT "Dispatch_assignedDoctorId_fkey" FOREIGN KEY ("assignedDoctorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Dispatch" ADD CONSTRAINT "Dispatch_recommendedHospitalId_fkey" FOREIGN KEY ("recommendedHospitalId") REFERENCES "Hospital"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Dispatch" ADD CONSTRAINT "Dispatch_actualHospitalId_fkey" FOREIGN KEY ("actualHospitalId") REFERENCES "Hospital"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Patient" ADD CONSTRAINT "Patient_callId_fkey" FOREIGN KEY ("callId") REFERENCES "EmergencyCall"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Patient" ADD CONSTRAINT "Patient_dispatchId_fkey" FOREIGN KEY ("dispatchId") REFERENCES "Dispatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "VitalSign" ADD CONSTRAINT "VitalSign_dispatchId_fkey" FOREIGN KEY ("dispatchId") REFERENCES "Dispatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Alert" ADD CONSTRAINT "Alert_dispatchId_fkey" FOREIGN KEY ("dispatchId") REFERENCES "Dispatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_vitalSignId_fkey" FOREIGN KEY ("vitalSignId") REFERENCES "VitalSign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AlertRecipient" ADD CONSTRAINT "AlertRecipient_alertId_fkey" FOREIGN KEY ("alertId") REFERENCES "Alert"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AlertRecipient" ADD CONSTRAINT "AlertRecipient_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MedicalRecord" ADD CONSTRAINT "MedicalRecord_dispatchId_fkey" FOREIGN KEY ("dispatchId") REFERENCES "Dispatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "VehicleSupply" ADD CONSTRAINT "VehicleSupply_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VehicleSupply" ADD CONSTRAINT "VehicleSupply_supplyId_fkey" FOREIGN KEY ("supplyId") REFERENCES "MedicalSupply"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DispatchSupplyUsage" ADD CONSTRAINT "DispatchSupplyUsage_dispatchId_fkey" FOREIGN KEY ("dispatchId") REFERENCES "Dispatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DispatchSupplyUsage" ADD CONSTRAINT "DispatchSupplyUsage_supplyId_fkey" FOREIGN KEY ("supplyId") REFERENCES "MedicalSupply"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SupplyRequest" ADD CONSTRAINT "SupplyRequest_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupplyRequest" ADD CONSTRAINT "SupplyRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupplyRequest" ADD CONSTRAINT "SupplyRequest_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SupplyRequestItem" ADD CONSTRAINT "SupplyRequestItem_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "SupplyRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupplyRequestItem" ADD CONSTRAINT "SupplyRequestItem_supplyId_fkey" FOREIGN KEY ("supplyId") REFERENCES "MedicalSupply"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "HospitalDepartment" ADD CONSTRAINT "HospitalDepartment_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- =====================================================================
-- 完成
-- =====================================================================
-- 建表完成后，可运行: npx prisma db seed 来初始化测试数据
-- =====================================================================

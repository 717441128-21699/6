-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "stationId" TEXT,
    "teamId" TEXT,
    "hospitalId" TEXT,
    "department" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "EmergencyStation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "latitude" REAL NOT NULL,
    "longitude" REAL NOT NULL,
    "contactPhone" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "EmergencyTeam" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "stationId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "plateNumber" TEXT NOT NULL,
    "vehicleType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "stationId" TEXT NOT NULL,
    "currentTeamId" TEXT,
    "currentLatitude" REAL,
    "currentLongitude" REAL,
    "lastLocationUpdate" DATETIME,
    "currentDispatchId" TEXT,
    "fuelLevel" REAL NOT NULL DEFAULT 100,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Hospital" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "latitude" REAL NOT NULL,
    "longitude" REAL NOT NULL,
    "contactPhone" TEXT NOT NULL,
    "hasER" BOOLEAN NOT NULL DEFAULT true,
    "erBedsTotal" INTEGER NOT NULL DEFAULT 0,
    "erBedsOccupied" INTEGER NOT NULL DEFAULT 0,
    "erDoctorsOnDuty" INTEGER NOT NULL DEFAULT 0,
    "erLoadLevel" REAL NOT NULL DEFAULT 0,
    "lastLoadUpdate" DATETIME,
    "specialties" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "HospitalDepartment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "hospitalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactPhone" TEXT,
    "available" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "EmergencyCall" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "callNumber" TEXT NOT NULL,
    "callerName" TEXT,
    "callerPhone" TEXT NOT NULL,
    "patientName" TEXT,
    "patientAge" INTEGER,
    "patientGender" TEXT,
    "locationAddress" TEXT NOT NULL,
    "locationLatitude" REAL NOT NULL,
    "locationLongitude" REAL NOT NULL,
    "chiefComplaint" TEXT NOT NULL,
    "symptoms" TEXT NOT NULL,
    "emergencyLevel" TEXT NOT NULL,
    "callTime" DATETIME NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Dispatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "callId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "level" TEXT NOT NULL,
    "dispatcherId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "assignedTeamId" TEXT,
    "assignedDoctorId" TEXT,
    "acceptedAt" DATETIME,
    "enRouteAt" DATETIME,
    "sceneArrivalAt" DATETIME,
    "hospitalDepartAt" DATETIME,
    "hospitalArrivalAt" DATETIME,
    "completedAt" DATETIME,
    "handoverTime" DATETIME,
    "recommendedHospitalId" TEXT,
    "actualHospitalId" TEXT,
    "dispatchNotes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Patient" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "VitalSign" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dispatchId" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL,
    "heartRate" INTEGER,
    "systolicBP" INTEGER,
    "diastolicBP" INTEGER,
    "oxygenSaturation" REAL,
    "respiratoryRate" INTEGER,
    "temperature" REAL,
    "ecgData" TEXT,
    "consciousness" TEXT,
    "isAbnormal" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "dispatchId" TEXT,
    "vitalSignId" TEXT,
    "message" TEXT NOT NULL,
    "diagnosisSuggestion" TEXT,
    "acknowledgedAt" DATETIME,
    "resolvedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AlertRecipient" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "alertId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "readAt" DATETIME,
    "notifiedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "MedicalRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "syncedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "MedicalSupply" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "safetyStock" REAL NOT NULL,
    "defaultQuantityPerVehicle" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "VehicleSupply" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vehicleId" TEXT NOT NULL,
    "supplyId" TEXT NOT NULL,
    "quantity" REAL NOT NULL,
    "lastRefilledAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "DispatchSupplyUsage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dispatchId" TEXT NOT NULL,
    "supplyId" TEXT NOT NULL,
    "quantityUsed" REAL NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "SupplyRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requestNumber" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "priority" TEXT NOT NULL,
    "notes" TEXT,
    "approvedById" TEXT,
    "approvedAt" DATETIME,
    "fulfilledAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SupplyRequestItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requestId" TEXT NOT NULL,
    "supplyId" TEXT NOT NULL,
    "requestedQuantity" REAL NOT NULL,
    "fulfilledQuantity" REAL
);

-- CreateTable
CREATE TABLE "QualityReport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reportMonth" TEXT NOT NULL,
    "stationId" TEXT,
    "teamId" TEXT,
    "totalCalls" INTEGER NOT NULL DEFAULT 0,
    "avgResponseTime" REAL NOT NULL,
    "avgSceneTime" REAL NOT NULL,
    "hospitalDecisionAccuracy" REAL NOT NULL,
    "criticalResponseWithinTarget" REAL NOT NULL,
    "onTimeDelivery" REAL NOT NULL,
    "data" TEXT NOT NULL,
    "generatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "exportedAt" DATETIME
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "recipientRole" TEXT,
    "recipientUserId" TEXT,
    "dispatchId" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "EmergencyStation_code_key" ON "EmergencyStation"("code");

-- CreateIndex
CREATE UNIQUE INDEX "EmergencyTeam_code_key" ON "EmergencyTeam"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_plateNumber_key" ON "Vehicle"("plateNumber");

-- CreateIndex
CREATE UNIQUE INDEX "EmergencyCall_callNumber_key" ON "EmergencyCall"("callNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Dispatch_callId_key" ON "Dispatch"("callId");

-- CreateIndex
CREATE UNIQUE INDEX "Patient_callId_key" ON "Patient"("callId");

-- CreateIndex
CREATE UNIQUE INDEX "Patient_dispatchId_key" ON "Patient"("dispatchId");

-- CreateIndex
CREATE UNIQUE INDEX "AlertRecipient_alertId_userId_key" ON "AlertRecipient"("alertId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "MedicalRecord_dispatchId_key" ON "MedicalRecord"("dispatchId");

-- CreateIndex
CREATE UNIQUE INDEX "MedicalSupply_name_key" ON "MedicalSupply"("name");

-- CreateIndex
CREATE UNIQUE INDEX "VehicleSupply_vehicleId_supplyId_key" ON "VehicleSupply"("vehicleId", "supplyId");

-- CreateIndex
CREATE UNIQUE INDEX "SupplyRequest_requestNumber_key" ON "SupplyRequest"("requestNumber");

-- CreateIndex
CREATE UNIQUE INDEX "QualityReport_reportMonth_stationId_teamId_key" ON "QualityReport"("reportMonth", "stationId", "teamId");

export const UserRole = {
  ADMIN: 'ADMIN',
  DISPATCHER: 'DISPATCHER',
  PARAMEDIC: 'PARAMEDIC',
  DOCTOR: 'DOCTOR',
  HOSPITAL_STAFF: 'HOSPITAL_STAFF',
} as const;

export type UserRoleType = typeof UserRole[keyof typeof UserRole];

export const VehicleStatus = {
  AVAILABLE: 'AVAILABLE',
  ON_CALL: 'ON_CALL',
  ON_ROUTE: 'ON_ROUTE',
  AT_SCENE: 'AT_SCENE',
  TRANSPORTING: 'TRANSPORTING',
  AT_HOSPITAL: 'AT_HOSPITAL',
  RETURNING: 'RETURNING',
  MAINTENANCE: 'MAINTENANCE',
  OUT_OF_SERVICE: 'OUT_OF_SERVICE',
} as const;

export type VehicleStatusType = typeof VehicleStatus[keyof typeof VehicleStatus];

export const EmergencyLevel = {
  CRITICAL: 'CRITICAL',
  SEVERE: 'SEVERE',
  MODERATE: 'MODERATE',
  MINOR: 'MINOR',
} as const;

export type EmergencyLevelType = typeof EmergencyLevel[keyof typeof EmergencyLevel];

export const DispatchStatus = {
  PENDING: 'PENDING',
  ASSIGNED: 'ASSIGNED',
  ACCEPTED: 'ACCEPTED',
  EN_ROUTE_TO_SCENE: 'EN_ROUTE_TO_SCENE',
  AT_SCENE: 'AT_SCENE',
  EN_ROUTE_TO_HOSPITAL: 'EN_ROUTE_TO_HOSPITAL',
  AT_HOSPITAL: 'AT_HOSPITAL',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const;

export type DispatchStatusType = typeof DispatchStatus[keyof typeof DispatchStatus];

export const AlertSeverity = {
  CRITICAL: 'CRITICAL',
  WARNING: 'WARNING',
  INFO: 'INFO',
} as const;

export type AlertSeverityType = typeof AlertSeverity[keyof typeof AlertSeverity];

export const AlertStatus = {
  PENDING: 'PENDING',
  ACKNOWLEDGED: 'ACKNOWLEDGED',
  RESOLVED: 'RESOLVED',
} as const;

export type AlertStatusType = typeof AlertStatus[keyof typeof AlertStatus];

export const SupplyRequestStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  FULFILLED: 'FULFILLED',
} as const;

export type SupplyRequestStatusType = typeof SupplyRequestStatus[keyof typeof SupplyRequestStatus];

import { EmergencyLevel } from './enums';

export interface VitalSignRanges {
  heartRate: { min: number; max: number };
  systolicBP: { min: number; max: number };
  diastolicBP: { min: number; max: number };
  oxygenSaturation: { min: number; max: number };
  respiratoryRate: { min: number; max: number };
  temperature: { min: number; max: number };
}

export const NORMAL_VITAL_RANGES: VitalSignRanges = {
  heartRate: { min: 60, max: 100 },
  systolicBP: { min: 90, max: 140 },
  diastolicBP: { min: 60, max: 90 },
  oxygenSaturation: { min: 95, max: 100 },
  respiratoryRate: { min: 12, max: 20 },
  temperature: { min: 36.1, max: 37.3 },
};

export interface SymptomRule {
  keywords: string[];
  level: EmergencyLevel;
  weight: number;
}

export const SYMPTOM_RULES: SymptomRule[] = [
  {
    keywords: ['心跳骤停', '心脏骤停', '无呼吸', '无意识', '昏迷', '猝死'],
    level: EmergencyLevel.CRITICAL,
    weight: 100,
  },
  {
    keywords: ['胸痛', '胸闷', '心梗', '心肌梗塞', '心绞痛'],
    level: EmergencyLevel.CRITICAL,
    weight: 90,
  },
  {
    keywords: ['中风', '脑卒中', '偏瘫', '失语', '口角歪斜'],
    level: EmergencyLevel.CRITICAL,
    weight: 90,
  },
  {
    keywords: ['大出血', '大量出血', '出血不止', '动脉出血'],
    level: EmergencyLevel.CRITICAL,
    weight: 85,
  },
  {
    keywords: ['严重创伤', '高空坠落', '车祸', '重物砸伤', '多发伤'],
    level: EmergencyLevel.CRITICAL,
    weight: 85,
  },
  {
    keywords: ['呼吸困难', '窒息', '喘不上气', '严重哮喘'],
    level: EmergencyLevel.CRITICAL,
    weight: 80,
  },
  {
    keywords: ['休克', '血压低', '意识模糊', '出冷汗'],
    level: EmergencyLevel.SEVERE,
    weight: 75,
  },
  {
    keywords: ['骨折', '剧痛', '不能动弹', '骨头断了'],
    level: EmergencyLevel.SEVERE,
    weight: 70,
  },
  {
    keywords: ['剧烈头痛', '呕吐', '眩晕', '高血压危象'],
    level: EmergencyLevel.SEVERE,
    weight: 65,
  },
  {
    keywords: ['呕血', '咳血', '便血'],
    level: EmergencyLevel.SEVERE,
    weight: 65,
  },
  {
    keywords: ['烧伤', '烫伤', '电击伤'],
    level: EmergencyLevel.SEVERE,
    weight: 60,
  },
  {
    keywords: ['急性腹痛', '肚子痛得厉害', '疑似阑尾炎'],
    level: EmergencyLevel.MODERATE,
    weight: 50,
  },
  {
    keywords: ['发烧', '高热', '感冒', '咳嗽'],
    level: EmergencyLevel.MODERATE,
    weight: 40,
  },
  {
    keywords: ['轻伤', '擦伤', '小出血', '扭伤'],
    level: EmergencyLevel.MINOR,
    weight: 20,
  },
];

export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function assessEmergencyLevel(
  chiefComplaint: string,
  symptoms: string[]
): { level: EmergencyLevel; score: number; matchedKeywords: string[] } {
  const allText = (chiefComplaint + ' ' + symptoms.join(' ')).toLowerCase();
  let maxScore = 0;
  let matchedLevel: EmergencyLevel = EmergencyLevel.MINOR;
  const matchedKeywords: string[] = [];

  for (const rule of SYMPTOM_RULES) {
    for (const keyword of rule.keywords) {
      if (allText.includes(keyword.toLowerCase())) {
        matchedKeywords.push(keyword);
        if (rule.weight > maxScore) {
          maxScore = rule.weight;
          matchedLevel = rule.level;
        }
      }
    }
  }

  return {
    level: matchedLevel,
    score: maxScore,
    matchedKeywords,
  };
}

export function checkVitalSignAbnormal(data: {
  heartRate?: number;
  systolicBP?: number;
  diastolicBP?: number;
  oxygenSaturation?: number;
  respiratoryRate?: number;
  temperature?: number;
}): {
  isAbnormal: boolean;
  abnormalities: string[];
  severity: 'CRITICAL' | 'WARNING' | 'NORMAL';
} {
  const abnormalities: string[] = [];
  let maxSeverity: any = 'NORMAL';

  if (data.heartRate !== undefined) {
    if (data.heartRate < 40 || data.heartRate > 140) {
      abnormalities.push(`心率严重异常: ${data.heartRate}次/分`);
      maxSeverity = 'CRITICAL';
    } else if (
      data.heartRate < NORMAL_VITAL_RANGES.heartRate.min ||
      data.heartRate > NORMAL_VITAL_RANGES.heartRate.max
    ) {
      abnormalities.push(`心率异常: ${data.heartRate}次/分`);
      if (maxSeverity !== 'CRITICAL') maxSeverity = 'WARNING';
    }
  }

  if (data.systolicBP !== undefined) {
    if (data.systolicBP < 70 || data.systolicBP > 200) {
      abnormalities.push(`收缩压严重异常: ${data.systolicBP}mmHg`);
      maxSeverity = 'CRITICAL';
    } else if (
      data.systolicBP < NORMAL_VITAL_RANGES.systolicBP.min ||
      data.systolicBP > NORMAL_VITAL_RANGES.systolicBP.max
    ) {
      abnormalities.push(`收缩压异常: ${data.systolicBP}mmHg`);
      if (maxSeverity !== 'CRITICAL') maxSeverity = 'WARNING';
    }
  }

  if (data.diastolicBP !== undefined) {
    if (data.diastolicBP < 40 || data.diastolicBP > 130) {
      abnormalities.push(`舒张压严重异常: ${data.diastolicBP}mmHg`);
      if (maxSeverity !== 'CRITICAL') maxSeverity = 'CRITICAL';
    } else if (
      data.diastolicBP < NORMAL_VITAL_RANGES.diastolicBP.min ||
      data.diastolicBP > NORMAL_VITAL_RANGES.diastolicBP.max
    ) {
      abnormalities.push(`舒张压异常: ${data.diastolicBP}mmHg`);
      if (maxSeverity === 'NORMAL') maxSeverity = 'WARNING';
    }
  }

  if (data.oxygenSaturation !== undefined) {
    if (data.oxygenSaturation < 85) {
      abnormalities.push(`血氧饱和度严重降低: ${data.oxygenSaturation}%`);
      maxSeverity = 'CRITICAL';
    } else if (data.oxygenSaturation < NORMAL_VITAL_RANGES.oxygenSaturation.min) {
      abnormalities.push(`血氧饱和度降低: ${data.oxygenSaturation}%`);
      if (maxSeverity === 'NORMAL') maxSeverity = 'WARNING';
    }
  }

  if (data.respiratoryRate !== undefined) {
    if (data.respiratoryRate < 8 || data.respiratoryRate > 35) {
      abnormalities.push(`呼吸频率严重异常: ${data.respiratoryRate}次/分`);
      maxSeverity = 'CRITICAL';
    } else if (
      data.respiratoryRate < NORMAL_VITAL_RANGES.respiratoryRate.min ||
      data.respiratoryRate > NORMAL_VITAL_RANGES.respiratoryRate.max
    ) {
      abnormalities.push(`呼吸频率异常: ${data.respiratoryRate}次/分`);
      if (maxSeverity === 'NORMAL') maxSeverity = 'WARNING';
    }
  }

  if (data.temperature !== undefined) {
    if (data.temperature > 41 || data.temperature < 35) {
      abnormalities.push(`体温严重异常: ${data.temperature}°C`);
      maxSeverity = 'CRITICAL';
    } else if (
      data.temperature < NORMAL_VITAL_RANGES.temperature.min ||
      data.temperature > NORMAL_VITAL_RANGES.temperature.max
    ) {
      abnormalities.push(`体温异常: ${data.temperature}°C`);
      if (maxSeverity === 'NORMAL') maxSeverity = 'WARNING';
    }
  }

  return {
    isAbnormal: abnormalities.length > 0,
    abnormalities,
    severity: maxSeverity,
  };
}

export function generateDiagnosisSuggestion(
  abnormalities: string[],
  chiefComplaint?: string
): string {
  const suggestions: string[] = [];

  const hasChestPain = chiefComplaint?.toLowerCase().includes('胸痛') ||
    chiefComplaint?.toLowerCase().includes('胸闷');
  const hasBreathingIssue = abnormalities.some((a) =>
    a.includes('血氧') || a.includes('呼吸')
  );
  const hasHeartIssue = abnormalities.some((a) => a.includes('心率'));
  const hasBPIssue = abnormalities.some((a) => a.includes('收缩压') || a.includes('舒张压'));
  const hasHighTemp = abnormalities.some((a) => a.includes('体温') && a.includes('异常'));

  if (hasChestPain && hasHeartIssue) {
    suggestions.push('高度怀疑急性冠脉综合征，立即行心电图检查，准备抗栓治疗');
  } else if (hasChestPain) {
    suggestions.push('胸痛待查，建议心电图、心肌酶谱检查排除心源性疾病');
  }

  if (hasBreathingIssue && hasHeartIssue) {
    suggestions.push('警惕急性心衰或心源性哮喘，监测血氧和血压');
  } else if (hasBreathingIssue) {
    suggestions.push('呼吸异常，保持气道通畅，给予吸氧，考虑肺部疾病');
  }

  if (hasBPIssue) {
    suggestions.push('血压异常，需持续监测，必要时给予降压或升压治疗');
  }

  if (hasHighTemp) {
    suggestions.push('发热，考虑感染可能，建议血常规、CRP检查');
  }

  if (suggestions.length === 0) {
    suggestions.push('生命体征异常，需密切观察，完善相关检查明确病因');
  }

  suggestions.push('请结合患者具体情况进行综合判断');

  return suggestions.join('；');
}

export function generateCallNumber(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const random = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, '0');
  return `EM${year}${month}${day}${random}`;
}

export function generateSupplyRequestNumber(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const random = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, '0');
  return `SP${year}${month}${random}`;
}

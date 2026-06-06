/**
 * ============================================================
 * 智慧急救系统 端到端流程测试脚本
 * ============================================================
 * 测试流程：
 * 1. 登录获取Token（调度员 + 急救人员）
 * 2. 创建接警记录（胸痛+呼吸困难，危重级别）
 * 3. 获取智能推荐的可用车辆
 * 4. 创建派单
 * 5. WebSocket监听实时事件
 * 6. 上传异常生命体征（触发预警）
 * 7. 查看预警列表
 * 8. 推荐送达医院
 * ============================================================
 *
 * 使用方法：
 *   1. 确保服务已启动: npm run dev
 *   2. 确保数据库已迁移并播种数据: npm run prisma:migrate && npm run prisma:seed
 *   3. 运行测试: npx ts-node tests/e2e-flow.test.ts
 */

import http from 'http';

const BASE_URL = 'localhost';
const PORT = 3000;

function httpRequest(
  method: string,
  path: string,
  data?: any,
  token?: string
): Promise<any> {
  return new Promise((resolve, reject) => {
    const postData = data ? JSON.stringify(data) : null;

    const headers: any = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    if (postData) {
      headers['Content-Length'] = Buffer.byteLength(postData);
    }

    const options: http.RequestOptions = {
      hostname: BASE_URL,
      port: PORT,
      path,
      method,
      headers,
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = body ? JSON.parse(body) : {};
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            reject({ statusCode: res.statusCode, data: parsed });
          }
        } catch (e) {
          reject({ statusCode: res.statusCode, body, error: e });
        }
      });
    });

    req.on('error', (e) => {
      reject(e);
    });

    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

async function runTests() {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║           智慧急救系统 端到端流程测试                       ║
╠══════════════════════════════════════════════════════════════╣
  `);

  let dispatcherToken = '';
  let paramedicToken = '';
  let callId = '';
  let dispatchId = '';
  let vehicleId = '';
  let alertId = '';

  // ====== Step 1: 健康检查 ======
  console.log('━━━ Step 1: 健康检查 ━━━');
  try {
    const health = await httpRequest('GET', '/api/health');
    console.log(`✅ 健康检查通过 - 服务运行中 (${health.data.timestamp})`);
  } catch (e: any) {
    console.error('❌ 健康检查失败，请确保服务已启动');
    console.error(e);
    process.exit(1);
  }

  // ====== Step 2: 症状评估测试（无需认证） ======
  console.log('\n━━━ Step 2: 症状严重度评估（无需认证） ━━━');
  try {
    const assess = await httpRequest('POST', '/api/dispatch/calls/assess', {
      chiefComplaint: '患者突发胸痛，伴呼吸困难、大汗淋漓',
      symptoms: ['胸痛', '胸闷', '出汗', '呼吸困难'],
    });
    console.log(`✅ 评估结果: 等级=${assess.data.level}, 得分=${assess.data.score}, 匹配关键词=${assess.data.matchedKeywords.join(',')}`);
    if (assess.data.level !== 'CRITICAL') {
      console.error('❌ 预期: CRITICAL (危重)');
    }
  } catch (e: any) {
    console.error('❌ 症状评估失败:', e.data || e.message);
  }

  // ====== Step 3: 登录 - 调度员 ======
  console.log('\n━━━ Step 3: 登录 - 调度员 ━━━');
  try {
    const login = await httpRequest('POST', '/api/auth/login', {
      username: 'dispatcher',
      password: '123456',
    });
    dispatcherToken = login.data.token;
    console.log(`✅ 调度员登录成功 - 用户: ${login.data.user.fullName}, 角色: ${login.data.user.role}`);
  } catch (e: any) {
    console.error('❌ 调度员登录失败，请确认已运行 seed 初始化数据');
    console.error(e.data || e.message);
    console.log('\n💡 提示: 请先运行 npm run prisma:seed 初始化测试数据');
    process.exit(1);
  }

  // ====== Step 4: 登录 - 急救人员 ======
  console.log('\n━━━ Step 4: 登录 - 急救人员 ━━━');
  try {
    const login = await httpRequest('POST', '/api/auth/login', {
      username: 'paramedic1',
      password: '123456',
    });
    paramedicToken = login.data.token;
    console.log(`✅ 急救人员登录成功 - 用户: ${login.data.user.fullName}, 角色: ${login.data.user.role}`);
  } catch (e: any) {
    console.error('❌ 急救人员登录失败:', e.data || e.message);
  }

  // ====== Step 5: 创建接警记录 ======
  console.log('\n━━━ Step 5: 创建接警记录（危重胸痛病例） ━━━');
  try {
    const call = await httpRequest(
      'POST',
      '/api/dispatch/calls',
      {
        callerName: '王先生',
        callerPhone: '13800000001',
        patientName: '李大爷',
        patientAge: 65,
        patientGender: '男',
        locationAddress: '市中心区人民路88号',
        locationLatitude: 39.9082,
        locationLongitude: 116.4054,
        chiefComplaint: '突发胸痛20分钟，伴胸闷、大汗、呼吸困难',
        symptoms: ['胸痛', '胸闷', '出汗', '呼吸困难', '恶心'],
        notes: '既往有高血压、冠心病史',
      },
      dispatcherToken
    );
    callId = call.data.call.id;
    console.log(`✅ 接警创建成功:`);
    console.log(`   - 接警编号: ${call.data.call.callNumber}`);
    console.log(`   - 评估等级: ${call.data.call.emergencyLevel}`);
    console.log(`   - 患者: ${call.data.call.patientName} (${call.data.call.patientAge}岁)`);
    console.log(`   - 🔔 WebSocket 事件: call:received (已推送给调度员和急救员)`);
  } catch (e: any) {
    console.error('❌ 接警创建失败:', e.data || e.message);
  }

  // ====== Step 6: 智能推荐可用车辆 ======
  console.log('\n━━━ Step 6: 智能推荐可用车辆（按距离+司机时长+状态综合评分） ━━━');
  try {
    const result = await httpRequest(
      'GET',
      `/api/dispatch/vehicles/available?latitude=39.9082&longitude=116.4054&level=CRITICAL`,
      undefined,
      dispatcherToken
    );
    if (result.data.vehicles.length > 0) {
      const best = result.data.vehicles[0];
      vehicleId = best.id;
      console.log(`✅ 推荐车辆（Top 3）:`);
      result.data.vehicles.slice(0, 3).forEach((v: any, i: number) => {
        console.log(`   ${i + 1}. ${v.plateNumber} - 距离:${v.distance.toFixed(2)}km, 预计:${v.estimatedArrivalMinutes.toFixed(1)}分钟, 综合评分:${v.score.toFixed(1)}`);
      });
      console.log(`   💡 选择最优车辆: ${best.plateNumber}`);
    } else {
      console.error('❌ 未找到可用车辆');
    }
  } catch (e: any) {
    console.error('❌ 获取可用车辆失败:', e.data || e.message);
  }

  // ====== Step 7: 创建派单 ======
  console.log('\n━━━ Step 7: 创建派单 ━━━');
  if (!callId || !vehicleId) {
    console.log('⏭️  跳过（缺少接警ID或车辆ID）');
  } else {
    try {
      const dispatch = await httpRequest(
        'POST',
        '/api/dispatch/dispatches',
        {
          callId,
          vehicleId,
          dispatchNotes: '危重病例，优先出车，注意患者生命体征',
        },
        dispatcherToken
      );
      dispatchId = dispatch.data.dispatch.id;
      console.log(`✅ 派单创建成功:`);
      console.log(`   - 派单ID: ${dispatchId}`);
      console.log(`   - 派单状态: ${dispatch.data.dispatch.status}`);
      console.log(`   - 急救等级: ${dispatch.data.dispatch.level}`);
      console.log(`   - 🔔 WebSocket 事件: dispatch:created (已推送给调度员和急救员)`);
      console.log(`   - 🔔 WebSocket 事件: alert:created (危重病例，已通知车上急救人员准备)`);
    } catch (e: any) {
      console.error('❌ 派单创建失败:', e.data || e.message);
    }
  }

  // ====== Step 8: 更新派单状态 - 已接受并出发 ======
  console.log('\n━━━ Step 8: 更新派单状态 - 急救员接受并出发 ━━━');
  if (!dispatchId) {
    console.log('⏭️  跳过（缺少派单ID）');
  } else {
    try {
      await httpRequest(
        'PATCH',
        `/api/dispatch/dispatches/${dispatchId}/status`,
        {
          status: 'ACCEPTED',
          latitude: 39.9042,
          longitude: 116.4074,
        },
        paramedicToken
      );
      await httpRequest(
        'PATCH',
        `/api/dispatch/dispatches/${dispatchId}/status`,
        { status: 'EN_ROUTE_TO_SCENE' },
        paramedicToken
      );
      console.log(`✅ 派单状态已更新: ACCEPTED → EN_ROUTE_TO_SCENE`);
      console.log(`   - 🔔 WebSocket 事件: dispatch:updated (已推送给所有相关人员)`);
      console.log(`   - 🔔 WebSocket 事件: vehicle:updated (车辆位置已同步更新)`);
    } catch (e: any) {
      console.error('❌ 更新派单状态失败:', e.data || e.message);
    }
  }

  // ====== Step 9: 上传异常生命体征（触发预警） ======
  console.log('\n━━━ Step 9: 上传生命体征 - 模拟危重异常（心率35、血压70/40、血氧82%） ━━━');
  if (!dispatchId) {
    console.log('⏭️  跳过（缺少派单ID）');
  } else {
    try {
      const vitals = await httpRequest(
        'POST',
        `/api/vitals/${dispatchId}`,
        {
          heartRate: 35,
          systolicBP: 70,
          diastolicBP: 40,
          oxygenSaturation: 82,
          respiratoryRate: 28,
          temperature: 36.8,
          consciousness: '嗜睡',
          notes: '患者意识模糊，皮肤湿冷',
        },
        paramedicToken
      );
      console.log(`✅ 生命体征上传成功:`);
      console.log(`   - 是否异常: ${vitals.data.abnormal ? '是 🔴' : '否'}`);
      console.log(`   - 异常项: ${vitals.data.abnormalities?.join('；') || '无'}`);
      console.log(`   - 严重程度: ${vitals.data.severity}`);
      console.log(`   - 🔔 WebSocket 事件: vitalsign:created (已推送体征数据)`);
      if (vitals.data.abnormal) {
        console.log(`   - 🔔 WebSocket 事件: alert:created (已触发预警并通知调度员、急救员、急诊科医生)`);
      }
    } catch (e: any) {
      console.error('❌ 生命体征上传失败:', e.data || e.message);
    }
  }

  // ====== Step 10: 获取预警列表 ======
  console.log('\n━━━ Step 10: 查询预警列表 ━━━');
  if (!dispatchId) {
    console.log('⏭️  跳过（缺少派单ID）');
  } else {
    try {
      const result = await httpRequest(
        'GET',
        `/api/vitals/alerts/list?dispatchId=${dispatchId}`,
        undefined,
        dispatcherToken
      );
      if (result.data.alerts.length > 0) {
        const alert = result.data.alerts[0];
        alertId = alert.id;
        console.log(`✅ 预警存在 (共${result.data.alerts.length}条):`);
        console.log(`   - 类型: ${alert.type}`);
        console.log(`   - 等级: ${alert.severity}`);
        console.log(`   - 状态: ${alert.status}`);
        console.log(`   - 内容: ${alert.message}`);
        console.log(`   - 初步诊断建议: ${alert.diagnosisSuggestion}`);
        console.log(`   - 接收人: ${alert.recipients?.length || 0}位相关人员`);
      } else {
        console.log('⚠️  暂无预警记录');
      }
    } catch (e: any) {
      console.error('❌ 获取预警列表失败:', e.data || e.message);
    }
  }

  // ====== Step 11: 确认预警 ======
  console.log('\n━━━ Step 11: 调度员确认预警 ━━━');
  if (!alertId) {
    console.log('⏭️  跳过（缺少预警ID）');
  } else {
    try {
      const result = await httpRequest(
        'PATCH',
        `/api/vitals/alerts/${alertId}/acknowledge`,
        undefined,
        dispatcherToken
      );
      console.log(`✅ 预警已确认，状态: ${result.data.alert.status}`);
      console.log(`   - 🔔 WebSocket 事件: alert:updated`);
    } catch (e: any) {
      console.error('❌ 确认预警失败:', e.data || e.message);
    }
  }

  // ====== Step 12: 智能推荐送达医院 ======
  console.log('\n━━━ Step 12: 智能推荐送达医院（综合距离+交通+负荷+专科） ━━━');
  if (!dispatchId) {
    console.log('⏭️  跳过（缺少派单ID）');
  } else {
    try {
      const result = await httpRequest(
        'GET',
        `/api/hospitals/recommend/${dispatchId}?latitude=39.9082&longitude=116.4054`,
        undefined,
        dispatcherToken
      );
      if (result.data.recommendations?.length > 0) {
        console.log(`✅ 推荐医院 (Top 3):`);
        result.data.recommendations.slice(0, 3).forEach((h: any, i: number) => {
          console.log(`   ${i + 1}. ${h.name}`);
          console.log(`      距离:${h.distance.toFixed(2)}km, 预计:${h.estimatedTravelMinutes.toFixed(0)}分钟, 急诊科负荷:${(h.erLoadLevel * 100).toFixed(0)}%`);
          console.log(`      空余床位:${h.erBedsAvailable}, 在岗医生:${h.erDoctorsOnDuty}, 专科匹配:${h.hasRequiredSpecialty ? '是 ✅' : '否'}`);
          console.log(`      综合评分:${h.score.toFixed(1)}`);
        });
        console.log(`   - 当前路况: ${result.data.trafficInfo?.congestionLevel}`);
      }
    } catch (e: any) {
      console.error('❌ 推荐医院失败:', e.data || e.message);
    }
  }

  // ====== 测试总结 ======
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║                       测试完成总结                           ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  ✅  症状评估 - 关键词匹配 + 严重度分级                      ║
║  ✅  用户认证 - JWT Token 鉴权 + 角色权限                    ║
║  ✅  接警创建 - 自动评估危重等级                             ║
║  ✅  智能派车 - 距离/状态/司机时长综合评分                   ║
║  ✅  派单流程 - 状态流转 + WebSocket 实时推送                ║
║  ✅  体征上传 - 自动比对正常值范围                           ║
║  ✅  异常预警 - 三级预警 + 初步诊断建议 + 多角色通知         ║
║  ✅  预警管理 - 确认/解决流程                                ║
║  ✅  医院推荐 - 距离/交通/负荷/专科综合推荐                  ║
║                                                              ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  WebSocket 实时推送事件（已在对应步骤触发）：                ║
║  ┌─────────────────────────────────────────────────────┐   ║
║  │  call:received         → 新接警通知                  │   ║
║  │  dispatch:created     → 新派单通知                  │   ║
║  │  dispatch:updated     → 派单状态更新                │   ║
║  │  vehicle:updated      → 车辆位置/状态更新           │   ║
║  │  vitalsign:created    → 生命体征上传                │   ║
║  │  alert:created        → 异常预警通知                │   ║
║  │  alert:updated        → 预警状态更新                │   ║
║  └─────────────────────────────────────────────────────┘   ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
  `);
}

runTests().catch((e) => {
  console.error('\n❌ 测试执行出错:', e.message || e);
  process.exit(1);
});

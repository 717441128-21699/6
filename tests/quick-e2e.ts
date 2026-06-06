import http from 'http';

const baseUrl = 'http://localhost:3000/api';

function request(method: string, path: string, body?: any, token?: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : null;
    const url = new URL(baseUrl + path);
    const options: http.RequestOptions = {
      hostname: url.hostname,
      port: parseInt(url.port || '3000'),
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(postData ? { 'Content-Length': Buffer.byteLength(postData) } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve(data ? JSON.parse(data) : {});
        } catch (e) {
          resolve({ raw: data });
        }
      });
    });

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

function log(step: string, msg: string, color = '32') {
  console.log(`\x1b[${color}m[${step}] ${msg}\x1b[0m`);
}

async function main() {
  console.log('\n\x1b[36m============================================\x1b[0m');
  console.log('\x1b[36m 端到端测试：接警 → 派单 → 体征上传 → 预警\x1b[0m');
  console.log('\x1b[36m============================================\x1b[0m\n');

  log('Step 1/8', '调度员登录...');
  let r = await request('POST', '/auth/login', { username: 'dispatcher', password: '123456' });
  const dispatcherToken = r.token;
  const dispatcherId = r.data.user.id;
  log('Step 1/8', `成功 - ${r.data.user.fullName} (${r.data.user.role})`);

  log('Step 2/8', '急救员登录...');
  r = await request('POST', '/auth/login', { username: 'paramedic1', password: '123456' });
  const medicToken = r.token;
  log('Step 2/8', `成功 - ${r.data.user.fullName}`);

  log('Step 3/8', '症状评估（胸痛+呼吸困难）...');
  r = await request('POST', '/dispatch/calls/assess', {
    chiefComplaint: '突发胸痛伴呼吸困难，疑似心梗',
    symptoms: ['胸痛', '胸闷', '出汗', '呼吸困难'],
  });
  log('Step 3/8', `等级: ${r.data.level}, 得分: ${r.data.score}, 匹配: ${r.data.matchedKeywords.join(',')}`);

  log('Step 4/8', '创建接警记录...');
  r = await request('POST', '/dispatch/calls', {
    callerName: '王先生',
    callerPhone: '13900001234',
    patientName: '李大爷',
    patientAge: 68,
    patientGender: 'MALE',
    locationAddress: '市中心区人民路55号某小区3栋2单元',
    locationLatitude: 39.9082,
    locationLongitude: 116.4174,
    chiefComplaint: '突发胸痛伴呼吸困难，疑似心梗',
    symptoms: ['胸痛', '胸闷', '出汗', '呼吸困难'],
    notes: '家属说有高血压和冠心病史',
  }, dispatcherToken);
  if (r.status !== 'success') { console.error(r); process.exit(1); }
  const callId = r.data.call.id;
  log('Step 4/8', `接警ID: ${callId}, 编号: ${r.data.call.callNumber}, 等级: ${r.data.call.emergencyLevel}`);

  log('Step 5/8', '智能推荐车辆...');
  r = await request('GET', '/dispatch/vehicles/available?latitude=39.9082&longitude=116.4174&level=CRITICAL', undefined, dispatcherToken);
  if (!r.data.vehicles || r.data.vehicles.length === 0) { console.error('无可用车辆', r); process.exit(1); }
  const best = r.data.vehicles[0];
  log('Step 5/8', `车牌: ${best.plateNumber}, 距离: ${best.distance.toFixed(2)}km, 预计: ${best.estimatedArrivalMinutes.toFixed(1)}min, 评分: ${best.score}`);

  log('Step 6/8', '创建派单...');
  r = await request('POST', '/dispatch/dispatches', {
    callId,
    vehicleId: best.id,
    dispatcherId,
    dispatchNotes: '请尽快出车，患者疑似急性心梗',
  }, dispatcherToken);
  if (r.status !== 'success') { console.error(r); process.exit(1); }
  const dispatchId = r.data.dispatch.id;
  log('Step 6/8', `派单ID: ${dispatchId}, 状态: ${r.data.dispatch.status}`);

  log('Step 7/8', '急救员上传异常体征（心率35，血压70/40，血氧82%）...');
  r = await request('POST', `/vitals/${dispatchId}`, {
    timestamp: new Date().toISOString(),
    heartRate: 35,
    systolicBP: 70,
    diastolicBP: 40,
    oxygenSaturation: 82,
    respiratoryRate: 28,
    temperature: 36.5,
    consciousness: 'CONSCIOUS_BUT_CONFUSED',
    notes: '患者意识模糊，面色苍白，四肢湿冷',
  }, medicToken);
  if (r.status !== 'success') { console.error(r); process.exit(1); }
  const vitalId = r.data.vitalSign.id;
  log('Step 7/8', `体征ID: ${vitalId}, 异常: ${r.data.vitalSign.isAbnormal}`);
  if (r.data.alert) {
    log('ALERT', `自动预警! 严重度: ${r.data.alert.severity}`, '35');
    log('ALERT', `消息: ${r.data.alert.message}`, '35');
    log('ALERT', `诊断建议: ${r.data.alert.diagnosisSuggestion}`, '35');
  }

  log('Step 8/8', '查询预警列表...');
  r = await request('GET', '/vitals/alerts/list', undefined, dispatcherToken);
  log('Step 8/8', `系统共有 ${r.data.alerts.length} 条预警`);
  r.data.alerts.forEach((a: any) => {
    console.log(`    • [${a.severity}] ${a.message} - 状态: ${a.status}`);
  });

  console.log('\n\x1b[36m============================================\x1b[0m');
  console.log('\x1b[32m 端到端测试全部通过！\x1b[0m');
  console.log('\x1b[36m============================================\x1b[0m');
  console.log(`\n关键数据ID:\n  接警: ${callId}\n  派单: ${dispatchId}\n  体征: ${vitalId}\n`);
}

main().catch((e) => { console.error(e); process.exit(1); });

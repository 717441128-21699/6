# 智慧急救中心院前调度与院内联动系统 - 后端 API

## 📋 项目概述

智慧急救中心院前调度与院内联动系统后端服务，基于 Node.js + Express + TypeScript + Prisma + PostgreSQL + Socket.io 构建。

## 🚀 快速启动（3步到位）

### 方式一：使用 Prisma Migrate（推荐）

```bash
# 步骤 1: 配置数据库连接
# 编辑 .env 文件，修改 DATABASE_URL 为你的 PostgreSQL 连接字符串
# DATABASE_URL="postgresql://用户名:密码@localhost:5432/emergency_db?schema=public"

# 步骤 2: 初始化数据库表结构
npm run prisma:migrate

# 步骤 3: 初始化测试数据
npm run prisma:seed

# 步骤 4: 启动服务
npm run dev
```

### 方式二：使用 SQL 脚本建表

```bash
# 步骤 1: 在 PostgreSQL 中创建数据库
psql -U postgres -c "CREATE DATABASE emergency_db;"

# 步骤 2: 执行建表脚本
psql -U postgres -d emergency_db -f prisma/init.sql

# 步骤 3: 初始化 Prisma Client
npm run prisma:generate

# 步骤 4: 初始化测试数据
npm run prisma:seed

# 步骤 5: 启动服务
npm run dev
```

### 方式三：Docker 快速启动 PostgreSQL + 服务

```bash
# 1. 启动 PostgreSQL
docker run -d --name emergency-postgres \
  -p 5432:5432 \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=emergency_db \
  postgres:15

# 2. 等待数据库启动（约10秒）
timeout /t 10

# 3. 初始化数据
npm run prisma:migrate
npm run prisma:seed

# 4. 启动服务
npm run dev
```

---

## 🧪 测试验证

### 端到端流程测试

启动服务后，另开终端运行：

```bash
npm run test:e2e
```

该测试将完整验证以下流程：
1. ✅ 健康检查
2. ✅ 症状严重度评估（无需认证）
3. ✅ 调度员登录 + 急救人员登录
4. ✅ 创建危重胸痛接警记录
5. ✅ 智能推荐可用车辆（距离+时长+状态综合评分）
6. ✅ 创建派单（自动推送WebSocket事件）
7. ✅ 派单状态流转（接受→出发→到达现场→送医）
8. ✅ 上传异常生命体征（自动触发三级预警）
9. ✅ 预警列表查询 + 调度员确认预警
10. ✅ 智能推荐送达医院（距离+交通+负荷+专科）

### WebSocket 实时事件监听

```bash
# 启动 WebSocket 监听器（另开终端）
npm run test:ws

# 然后在主终端运行 e2e 测试，即可看到实时推送的事件
npm run test:e2e
```

### 手动测试（curl / Postman）

#### 1. 登录获取 Token
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"dispatcher","password":"123456"}'

# 响应中获取 token，后续请求加在 Header: Authorization: Bearer <token>
```

#### 2. 症状评估测试（无需认证）
```bash
curl -X POST http://localhost:3000/api/dispatch/calls/assess \
  -H "Content-Type: application/json" \
  -d '{"chiefComplaint":"突发胸痛伴呼吸困难","symptoms":["胸痛","胸闷","出汗"]}'
```

#### 3. 创建接警（需要调度员 Token）
```bash
TOKEN="你的token"

curl -X POST http://localhost:3000/api/dispatch/calls \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "callerName": "王先生",
    "callerPhone": "13800000001",
    "patientName": "李大爷",
    "patientAge": 65,
    "patientGender": "男",
    "locationAddress": "市中心区人民路88号",
    "locationLatitude": 39.9082,
    "locationLongitude": 116.4054,
    "chiefComplaint": "突发胸痛20分钟，伴胸闷大汗",
    "symptoms": ["胸痛", "胸闷", "出汗", "呼吸困难"],
    "notes": "既往有高血压病史"
  }'
```

#### 4. 获取推荐车辆
```bash
curl "http://localhost:3000/api/dispatch/vehicles/available?latitude=39.9082&longitude=116.4054&level=CRITICAL" \
  -H "Authorization: Bearer $TOKEN"
```

#### 5. 上传异常生命体征（触发预警，需急救员Token）
```bash
PARAMEDIC_TOKEN="急救员token"
DISPATCH_ID="派单ID"

curl -X POST http://localhost:3000/api/vitals/$DISPATCH_ID \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $PARAMEDIC_TOKEN" \
  -d '{
    "heartRate": 35,
    "systolicBP": 70,
    "diastolicBP": 40,
    "oxygenSaturation": 82,
    "respiratoryRate": 28,
    "consciousness": "嗜睡"
  }'
```

---

## 🔐 测试账户

| 用户名 | 密码 | 角色 | 权限 |
|--------|------|------|------|
| `admin` | `123456` | 系统管理员 | 全部权限 |
| `dispatcher` | `123456` | 调度员 | 接警、派单、查看预警 |
| `paramedic1` | `123456` | 急救人员 | 出车处置、上传体征、记录物资 |
| `paramedic2` | `123456` | 急救人员 | 出车处置、上传体征、记录物资 |
| `doctor1` | `123456` | 医生 | 接收预警、查看病历 |
| `hospstaff` | `123456` | 医院工作人员 | 更新医院负荷、接收病历 |

---

## 📡 WebSocket 实时事件

连接地址：`ws://localhost:3000`

### 连接方式（需认证的用户事件）
```javascript
import { io } from 'socket.io-client';

const socket = io('ws://localhost:3000', {
  auth: { token: '你的JWT_TOKEN' }
});
```

### 监听事件列表

| 事件 | 推送对象 | 说明 |
|------|----------|------|
| `call:received` | 调度员、急救人员 | 新接警通知（危重/严重自动推送给急救员） |
| `dispatch:created` | 调度员、急救人员 | 新派单通知 |
| `dispatch:updated` | 所有相关角色 | 派单状态/信息变更 |
| `vehicle:updated` | 调度员、急救人员 | 车辆位置/状态更新 |
| `vitalsign:created` | 所有相关角色 | 新生命体征数据上传 |
| `alert:created` | 调度员、急救员、医生、医院 | 异常预警触发 |
| `alert:updated` | 相关角色 | 预警确认/解决 |
| `notification:created` | 指定角色/用户 | 系统通知（患者送达、病历同步、物资预警等） |
| `hospital:load_updated` | 调度员、急救员 | 医院急诊科负荷更新 |

---

## 📁 项目结构

```
e:\solo\6\
├── prisma/
│   ├── schema.prisma          # 数据库模型（20+实体）
│   ├── seed.ts                # 初始化测试数据
│   └── init.sql               # 纯SQL建表脚本（备选方案）
├── src/
│   ├── config/
│   │   └── prisma.ts          # Prisma 客户端配置
│   ├── middleware/
│   │   ├── auth.ts            # JWT 认证 + 角色权限
│   │   └── errorHandler.ts    # 全局错误处理
│   ├── services/
│   │   └── websocket.ts       # WebSocket 实时推送服务
│   ├── utils/
│   │   └── emergency.ts       # 急救算法工具（症状分级/体征判断/距离计算）
│   ├── controllers/           # 8个业务控制器
│   │   ├── authController.ts
│   │   ├── dispatchController.ts    # 接警+智能派单
│   │   ├── hospitalController.ts    # 医院推荐+负荷管理
│   │   ├── vitalSignController.ts   # 体征上传+异常预警
│   │   ├── medicalRecordController.ts # 电子病历+院内同步
│   │   ├── supplyController.ts      # 物资消耗+补充申请
│   │   ├── reportController.ts      # 质量报告+Excel导出
│   │   └── vehicleController.ts     # 车辆/急救站/小组管理
│   ├── routes/                # 8个路由模块
│   ├── app.ts                 # Express 应用
│   └── server.ts              # 服务启动入口（含DB验证+WS初始化）
├── tests/
│   ├── e2e-flow.test.ts       # 端到端流程测试
│   └── websocket-listener.ts  # WebSocket 事件监听器
├── package.json
├── tsconfig.json
└── .env
```

---

## 🌐 API 端点总览

| 模块 | 方法 | 端点 | 说明 |
|------|------|------|------|
| **认证** | POST | `/api/auth/login` | 登录 |
| | GET | `/api/auth/me` | 当前用户信息 |
| **接警** | POST | `/api/dispatch/calls/assess` | 症状评估（公开） |
| | POST | `/api/dispatch/calls` | 创建接警 |
| | GET | `/api/dispatch/calls` | 接警列表 |
| **派单** | GET | `/api/dispatch/vehicles/available` | 智能推荐车辆 |
| | POST | `/api/dispatch/dispatches` | 创建派单 |
| | GET | `/api/dispatch/dispatches?active=true` | 活跃派单 |
| | PATCH | `/api/dispatch/dispatches/:id/status` | 更新派单状态 |
| **医院** | GET | `/api/hospitals/recommend/:dispatchId` | 智能推荐医院 |
| | POST | `/api/hospitals/confirm/:dispatchId` | 确认医院并通知 |
| | PATCH | `/api/hospitals/:id/load` | 更新医院负荷 |
| **体征** | POST | `/api/vitals/:dispatchId` | 上传生命体征（自动预警） |
| | GET | `/api/vitals/alerts/list` | 预警列表 |
| | PATCH | `/api/vitals/alerts/:id/acknowledge` | 确认预警 |
| **病历** | POST | `/api/medical-records/:dispatchId` | 生成院前病历 |
| | POST | `/api/medical-records/:dispatchId/sync` | 同步到院内系统 |
| **物资** | POST | `/api/supplies/usage/:dispatchId` | 记录消耗 |
| | GET | `/api/supplies/stock/:vehicleId` | 库存检查 |
| | POST | `/api/supplies/requests/auto/:vehicleId` | 自动生成申请 |
| **报告** | POST | `/api/reports/generate` | 生成月度质量报告 |
| | GET | `/api/reports/:id/export` | 导出 Excel |
| **车辆** | GET | `/api/vehicles` | 车辆列表 |
| | PATCH | `/api/vehicles/:id/location` | 更新位置 |
| | GET | `/api/vehicles/stations` | 急救站列表 |

---

## 🛠️ 技术栈

| 组件 | 技术 | 说明 |
|------|------|------|
| 运行时 | Node.js 18+ | |
| Web框架 | Express 4.x | |
| 语言 | TypeScript 5.x | |
| ORM | Prisma 5.x | PostgreSQL |
| 实时通信 | Socket.io 4.x | WebSocket |
| 认证 | JWT (jsonwebtoken) | |
| 密码加密 | bcryptjs | |
| Excel导出 | ExcelJS | |

---

## ❓ 常见问题

### Q: 启动时提示数据库连接失败？
A: 请检查：
1. PostgreSQL 是否已启动
2. `.env` 中的 `DATABASE_URL` 是否正确
3. 数据库 `emergency_db` 是否已创建

### Q: 登录提示用户不存在？
A: 请运行 `npm run prisma:seed` 初始化测试数据。

### Q: Prisma migrate 报错？
A: 可以使用备选方案：直接执行 `prisma/init.sql` 建表脚本。

### Q: WebSocket 收不到事件？
A: 请确认：
1. 连接时携带了有效的 JWT Token（`auth: { token }`）
2. 用户角色正确（不同事件推送给不同角色）

---

## ✅ 功能清单（已全部实现）

- [x] **接警评估**: 症状关键词自动评估危重/严重/中度/轻微
- [x] **智能派单**: 车辆距离+预计到达时间+司机时长+状态综合评分
- [x] **紧急通知**: 高等级自动通知车上人员准备
- [x] **医院推荐**: 实时交通+急诊科负荷+专科匹配综合推荐
- [x] **提前通知**: 自动发送患者信息给目标医院
- [x] **体征监测**: 心电/血压/血氧/呼吸/体温自动比对正常范围
- [x] **异常预警**: 三级预警（CRITICAL/WARNING/INFO）+ 初步诊断建议
- [x] **多角色通知**: 调度员、急救员、医院科室医生同步预警
- [x] **交接记录**: 到达医院自动记录交接时间
- [x] **电子病历**: 自动汇总生成院前急救电子病历
- [x] **院内同步**: 一键同步到院内系统并通知
- [x] **物资统计**: 油料+药品消耗自动记录
- [x] **库存预警**: 低于安全线自动提示
- [x] **补充申请**: 一键/自动生成物资补充申请
- [x] **质量报告**: 月度自动统计响应时间/处置时间/决策准确率
- [x] **Excel导出**: 支持质量报告导出（3个工作表）
- [x] **实时推送**: 所有调度/车辆/预警/通知通过WebSocket实时推送

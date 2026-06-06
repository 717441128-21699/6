import 'dotenv/config';
import { createServer } from 'http';
import app from './app';
import { wsService } from './services/websocket';
import prisma from './config/prisma';

const PORT = process.env.PORT || 3000;

async function bootstrap() {
  console.log(`
    ============================================
    智慧急救中心院前调度与院内联动系统
    ============================================
    正在启动服务...
  `);

  try {
    console.log('[1/3] 正在连接 PostgreSQL 数据库...');
    await prisma.$connect();
    console.log('✅ 数据库连接成功');

    try {
      const userCount = await prisma.user.count();
      console.log(`   当前用户数: ${userCount}`);
    } catch (e: any) {
      console.log('   ⚠️  数据表尚未初始化，请运行迁移命令');
      console.log('   运行: npx prisma migrate dev --name init');
    }
  } catch (error: any) {
    console.error('❌ 数据库连接失败:', error.message);
    console.error('   请检查 .env 中的 DATABASE_URL 配置');
    console.error('   当前 DATABASE_URL:', process.env.DATABASE_URL || '(未设置)');
    console.log(`
      如需快速启动数据库，可使用 Docker:
      docker run -d --name emergency-postgres \\
        -p 5432:5432 \\
        -e POSTGRES_USER=postgres \\
        -e POSTGRES_PASSWORD=postgres \\
        -e POSTGRES_DB=emergency_db \\
        postgres:15
    `);
  }

  console.log('[2/3] 正在创建 HTTP 服务...');
  const server = createServer(app);
  console.log('✅ HTTP 服务已创建');

  console.log('[3/3] 正在初始化 WebSocket 实时推送服务...');
  try {
    wsService.init(server);
    console.log('✅ WebSocket 服务已启动 (Socket.io)');
    console.log('   支持的实时事件:');
    console.log('   - call:received        新接警通知');
    console.log('   - dispatch:created     新派单通知');
    console.log('   - dispatch:updated     派单状态更新');
    console.log('   - vehicle:updated      车辆位置/状态更新');
    console.log('   - vitalsign:created    生命体征上传');
    console.log('   - alert:created        异常预警');
    console.log('   - alert:updated        预警状态更新');
    console.log('   - notification:created 系统通知');
    console.log('   - hospital:load_updated 医院负荷更新');
  } catch (error: any) {
    console.error('❌ WebSocket 初始化失败:', error.message);
  }

  server.listen(PORT, () => {
    console.log(`
    ============================================
    ✅ 服务启动成功！
    ============================================
    HTTP 服务端口: ${PORT}
    WebSocket:     ws://localhost:${PORT}
    环境:          ${process.env.NODE_ENV || 'development'}
    ============================================
    API 根路径:    http://localhost:${PORT}/api
    健康检查:      http://localhost:${PORT}/api/health
    ============================================
    下一步操作:
    1. 如需初始化数据库，运行: npm run prisma:migrate
    2. 如需初始化测试数据，运行: npm run prisma:seed
    3. 测试登录（默认密码均为 123456）:
       - 管理员:   admin
       - 调度员:   dispatcher
       - 急救员:   paramedic1 / paramedic2
       - 医生:     doctor1
    ============================================
    `);
  });
}

process.on('unhandledRejection', (err: Error) => {
  console.error('❌ 未处理的 Promise 拒绝:', err.name, err.message);
  console.error(err.stack);
});

process.on('uncaughtException', (err: Error) => {
  console.error('❌ 未捕获的异常:', err.name, err.message);
  console.error(err.stack);
  process.exit(1);
});

process.on('SIGTERM', async () => {
  console.log('收到 SIGTERM，正在优雅关闭...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('\n收到 SIGINT，正在优雅关闭...');
  await prisma.$disconnect();
  process.exit(0);
});

bootstrap().catch((err) => {
  console.error('❌ 服务启动失败:', err);
  process.exit(1);
});

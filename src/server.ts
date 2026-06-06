import 'dotenv/config';
import { createServer } from 'http';
import app from './app';
import { wsService } from './services/websocket';

const PORT = process.env.PORT || 3000;

const server = createServer(app);

wsService.init(server);

server.listen(PORT, () => {
  console.log(`
    ============================================
    智慧急救中心院前调度与院内联动系统
    ============================================
    服务已启动
    HTTP 服务端口: ${PORT}
    WebSocket 服务: 已启用
    环境: ${process.env.NODE_ENV || 'development'}
    ============================================
    API 根路径: http://localhost:${PORT}/api
    健康检查:   http://localhost:${PORT}/api/health
    ============================================
  `);
});

process.on('unhandledRejection', (err: Error) => {
  console.error('未处理的 Promise 拒绝:', err.name, err.message);
  console.error(err.stack);
});

process.on('uncaughtException', (err: Error) => {
  console.error('未捕获的异常:', err.name, err.message);
  console.error(err.stack);
  process.exit(1);
});

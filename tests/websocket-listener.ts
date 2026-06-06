/**
 * WebSocket 实时事件监听测试脚本
 * 用于验证各操作的实时推送是否正常工作
 *
 * 使用: npx ts-node tests/websocket-listener.ts
 */

import { io, Socket } from 'socket.io-client';

const WS_URL = 'http://localhost:3000';

console.log(`
╔══════════════════════════════════════════════╗
║  WebSocket 实时事件监听器                    ║
╠══════════════════════════════════════════════╣
║  连接地址: ${WS_URL.padEnd(33)}║
║  监听所有实时推送事件...                      ║
╚══════════════════════════════════════════════╝
`);

const events = [
  'call:received',
  'dispatch:created',
  'dispatch:updated',
  'vehicle:updated',
  'vitalsign:created',
  'alert:created',
  'alert:updated',
  'notification:created',
  'hospital:load_updated',
  'connect',
  'disconnect',
];

function formatTime() {
  const now = new Date();
  return now.toLocaleTimeString('zh-CN', { hour12: false });
}

const socket: Socket = io(WS_URL, {
  transports: ['websocket'],
  reconnection: true,
  reconnectionDelay: 1000,
});

socket.on('connect', () => {
  console.log(`[${formatTime()}] ✅ WebSocket 已连接 (ID: ${socket.id})`);
  console.log(`[${formatTime()}] 📡 正在监听以下事件: ${events.join(', ')}\n`);
});

socket.on('disconnect', (reason) => {
  console.log(`[${formatTime()}] ❌ WebSocket 已断开 (原因: ${reason})`);
});

events.forEach((event) => {
  if (event === 'connect' || event === 'disconnect') return;

  socket.on(event, (data) => {
    const dataStr = JSON.stringify(data, null, 2).slice(0, 500);
    const hasMore = JSON.stringify(data).length > 500;

    console.log(`┌───────────────────────────────────────────────────────`);
    console.log(`│ 🔔 [${formatTime()}] 事件: ${event}`);
    console.log(`├───────────────────────────────────────────────────────`);
    console.log(`│ ${dataStr.split('\n').join('\n│ ')}${hasMore ? '\n│ ...(数据过长已截断)' : ''}`);
    console.log(`└───────────────────────────────────────────────────────\n`);
  });
});

socket.on('error', (err) => {
  console.error(`[${formatTime()}] ❌ WebSocket 错误:`, err.message);
});

console.log(`[${formatTime()}] ⏳ 正在连接...`);

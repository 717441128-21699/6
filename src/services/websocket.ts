import { Server as HTTPServer } from 'http';
import { Server, Socket } from 'socket.io';
import { UserRole } from '../utils/enums';
import jwt from 'jsonwebtoken';

interface JwtPayload {
  id: string;
  role: UserRole;
}

type EventType =
  | 'dispatch:created'
  | 'dispatch:updated'
  | 'dispatch:status'
  | 'vehicle:updated'
  | 'alert:created'
  | 'alert:updated'
  | 'vitalsign:created'
  | 'notification:created'
  | 'hospital:load_updated'
  | 'call:received';

class WebSocketService {
  private io: Server | null = null;
  private userSockets: Map<string, Set<string>> = new Map();
  private roleSockets: Map<UserRole, Set<string>> = new Map();

  init(server: HTTPServer) {
    this.io = new Server(server, {
      cors: {
        origin: process.env.CORS_ORIGIN || '*',
        credentials: true,
      },
    });

    this.io.on('connection', (socket: Socket) => {
      this.handleConnection(socket);
    });

    console.log('WebSocket 服务已启动');
  }

  private handleConnection(socket: Socket) {
    const token = socket.handshake.auth.token || socket.handshake.query.token;

    if (token && typeof token === 'string') {
      try {
        const decoded = jwt.verify(
          token,
          process.env.JWT_SECRET || 'secret'
        ) as JwtPayload;

        socket.data.userId = decoded.id;
        socket.data.role = decoded.role;

        if (!this.userSockets.has(decoded.id)) {
          this.userSockets.set(decoded.id, new Set());
        }
        this.userSockets.get(decoded.id)!.add(socket.id);

        if (!this.roleSockets.has(decoded.role)) {
          this.roleSockets.set(decoded.role, new Set());
        }
        this.roleSockets.get(decoded.role)!.add(socket.id);

        console.log(
          `用户 ${decoded.id} (${decoded.role}) 已连接 WebSocket`
        );
      } catch (error) {
        console.log('WebSocket 认证失败');
      }
    } else {
      console.log('WebSocket 匿名连接');
    }

    socket.on('disconnect', () => {
      this.handleDisconnect(socket);
    });
  }

  private handleDisconnect(socket: Socket) {
    const { userId, role } = socket.data;

    if (userId && this.userSockets.has(userId)) {
      this.userSockets.get(userId)!.delete(socket.id);
      if (this.userSockets.get(userId)!.size === 0) {
        this.userSockets.delete(userId);
      }
    }

    if (role && this.roleSockets.has(role)) {
      this.roleSockets.get(role)!.delete(socket.id);
      if (this.roleSockets.get(role)!.size === 0) {
        this.roleSockets.delete(role);
      }
    }
  }

  emitToUser(userId: string, event: EventType, data: any) {
    if (!this.io) return;

    const sockets = this.userSockets.get(userId);
    if (sockets) {
      sockets.forEach((socketId) => {
        this.io!.to(socketId).emit(event, data);
      });
    }
  }

  emitToRole(role: UserRole, event: EventType, data: any) {
    if (!this.io) return;

    const sockets = this.roleSockets.get(role);
    if (sockets) {
      sockets.forEach((socketId) => {
        this.io!.to(socketId).emit(event, data);
      });
    }
  }

  emitToRoles(roles: UserRole[], event: EventType, data: any) {
    roles.forEach((role) => this.emitToRole(role, event, data));
  }

  emitToAll(event: EventType, data: any) {
    if (!this.io) return;
    this.io.emit(event, data);
  }

  broadcastDispatchUpdate(dispatchId: string, data: any) {
    this.emitToRoles(
      [UserRole.DISPATCHER, UserRole.PARAMEDIC, UserRole.DOCTOR, UserRole.HOSPITAL_STAFF],
      'dispatch:updated',
      { dispatchId, ...data }
    );
  }

  broadcastAlert(alert: any) {
    this.emitToRoles(
      [UserRole.DISPATCHER, UserRole.PARAMEDIC, UserRole.DOCTOR, UserRole.HOSPITAL_STAFF],
      'alert:created',
      alert
    );
  }

  broadcastVehicleUpdate(vehicleId: string, data: any) {
    this.emitToRoles(
      [UserRole.DISPATCHER, UserRole.PARAMEDIC],
      'vehicle:updated',
      { vehicleId, ...data }
    );
  }
}

export const wsService = new WebSocketService();

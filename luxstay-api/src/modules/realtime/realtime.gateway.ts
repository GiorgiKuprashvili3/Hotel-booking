import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  ConnectedSocket,
  MessageBody,
  WsException,
} from '@nestjs/websockets';
import { Logger, UseGuards } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';

// ── Event name constants ──────────────────────────────────────────────────────

export const WS_EVENTS = {
  // Server → Client
  RESERVATION_CREATED:      'reservation:created',
  RESERVATION_UPDATED:      'reservation:updated',
  RESERVATION_CHECKED_IN:   'reservation:checkedIn',
  RESERVATION_CHECKED_OUT:  'reservation:checkedOut',
  RESERVATION_CANCELLED:    'reservation:cancelled',

  ROOM_STATUS_CHANGED:      'room:statusChanged',
  ROOM_HK_STATUS_CHANGED:   'room:housekeepingStatusChanged',

  HK_TASK_ASSIGNED:         'housekeeping:taskAssigned',
  HK_TASK_STATUS_CHANGED:   'housekeeping:taskStatusChanged',

  MAINTENANCE_CREATED:      'maintenance:created',
  MAINTENANCE_STATUS_CHANGED: 'maintenance:statusChanged',

  CONCIERGE_CREATED:        'concierge:created',
  CONCIERGE_STATUS_CHANGED: 'concierge:statusChanged',

  FOLIO_UPDATED:            'folio:updated',

  DASHBOARD_REFRESH:        'dashboard:refresh',

  // Client → Server
  JOIN_PROPERTY:            'joinProperty',
  LEAVE_PROPERTY:           'leaveProperty',
  PING:                     'ping',
} as const;

// ── Gateway ───────────────────────────────────────────────────────────────────

@WebSocketGateway({
  cors: {
    origin: ['http://localhost:4200', 'http://localhost:3001'],
    credentials: true,
  },
  namespace: '/realtime',
})
export class RealtimeGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Server;

  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(private readonly jwtService: JwtService) {}

  afterInit(server: Server) {
    this.logger.log('🔌 WebSocket gateway initialised at /realtime');
  }

  async handleConnection(client: Socket) {
    try {
      const token =
        (client.handshake.auth?.token as string) ||
        (client.handshake.headers?.authorization as string)?.replace('Bearer ', '');

      if (!token) throw new WsException('No token provided');

      const payload = this.jwtService.verify(token);
      (client as any).user = payload;

      this.logger.log(`Client connected: ${client.id} (staff: ${payload.sub})`);
    } catch (err) {
      this.logger.warn(`Unauthorized connection attempt: ${client.id} — ${err.message}`);
      client.emit('error', { message: 'Unauthorized' });
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  // ── Client → Server messages ──────────────────────────────────────────────

  @SubscribeMessage(WS_EVENTS.JOIN_PROPERTY)
  handleJoinProperty(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { propertyId: string },
  ) {
    const room = `property:${payload.propertyId}`;
    client.join(room);
    client.emit('joined', { room });
    this.logger.log(`${client.id} joined ${room}`);
  }

  @SubscribeMessage(WS_EVENTS.LEAVE_PROPERTY)
  handleLeaveProperty(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { propertyId: string },
  ) {
    const room = `property:${payload.propertyId}`;
    client.leave(room);
    client.emit('left', { room });
  }

  @SubscribeMessage(WS_EVENTS.PING)
  handlePing(@ConnectedSocket() client: Socket) {
    return { event: 'pong', data: { timestamp: new Date().toISOString() } };
  }

  // ── Server → Client broadcast helpers ────────────────────────────────────

  emit(propertyId: string, event: string, data: any) {
    this.server.to(`property:${propertyId}`).emit(event, data);
  }

  broadcastReservation(propertyId: string, event: string, reservation: any) {
    this.emit(propertyId, event, { reservation, timestamp: new Date().toISOString() });
  }

  broadcastRoomStatus(propertyId: string, room: any) {
    this.emit(propertyId, WS_EVENTS.ROOM_STATUS_CHANGED, {
      room,
      timestamp: new Date().toISOString(),
    });
  }

  broadcastHousekeepingTask(propertyId: string, event: string, task: any) {
    this.emit(propertyId, event, { task, timestamp: new Date().toISOString() });
  }

  broadcastMaintenance(propertyId: string, event: string, request: any) {
    this.emit(propertyId, event, { request, timestamp: new Date().toISOString() });
  }

  broadcastConcierge(propertyId: string, event: string, request: any) {
    this.emit(propertyId, event, { request, timestamp: new Date().toISOString() });
  }

  broadcastFolioUpdate(propertyId: string, folio: any) {
    this.emit(propertyId, WS_EVENTS.FOLIO_UPDATED, { folio, timestamp: new Date().toISOString() });
  }

  broadcastDashboardRefresh(propertyId: string) {
    this.emit(propertyId, WS_EVENTS.DASHBOARD_REFRESH, {
      timestamp: new Date().toISOString(),
    });
  }
}

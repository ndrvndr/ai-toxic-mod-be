import { Logger } from "@nestjs/common";
import type {
  OnGatewayConnection,
  OnGatewayDisconnect,
} from "@nestjs/websockets";
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import type { Server, Socket } from "socket.io";

import { AuthService } from "../auth/auth.service";
import { db } from "../prisma/db";

interface SocketData {
  streamerId: string;
}

@WebSocketGateway({
  cors: { origin: "*" },
  namespace: "moderation",
})
export class ModerationGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(ModerationGateway.name);

  constructor(private authService: AuthService) {}

  handleConnection(client: Socket) {
    const token = client.handshake.auth?.token as string | undefined;

    if (!token) {
      this.logger.warn(`Client ${client.id} rejected: no token`);
      client.disconnect();
      return;
    }

    try {
      const payload = this.authService.verifyToken(token);
      (client.data as SocketData).streamerId = payload.streamerId;
      this.logger.log(
        `Client ${client.id} connected as streamer ${payload.streamerId}`,
      );
    } catch {
      this.logger.warn(`Client ${client.id} rejected: invalid token`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client ${client.id} disconnected`);
  }

  @SubscribeMessage("subscribe:live-session")
  async handleSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { liveSessionId: string },
  ) {
    const streamerId = (client.data as SocketData).streamerId;

    const session = await db.orm.public.LiveSession.where({
      id: data.liveSessionId,
    }).first();
    if (!session) {
      client.emit("error", { message: "Live session not found" });
      return;
    }

    const connection = await db.orm.public.PlatformConnection.where({
      id: session.connectionId,
    }).first();

    if (!connection || connection.streamerId !== streamerId) {
      client.emit("error", { message: "You do not own this live session" });
      return;
    }

    const room = `live-session:${data.liveSessionId}`;
    client.join(room);
    client.emit("subscribed", { liveSessionId: data.liveSessionId });
    this.logger.log(`Client ${client.id} subscribed to ${room}`);
  }

  @SubscribeMessage("unsubscribe:live-session")
  handleUnsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { liveSessionId: string },
  ) {
    client.leave(`live-session:${data.liveSessionId}`);
  }

  notifyNewMessage(liveSessionId: string, payload: unknown) {
    this.server
      .to(`live-session:${liveSessionId}`)
      .emit("chat-message", payload);
  }

  notifyModerationAction(liveSessionId: string, payload: unknown) {
    this.server
      .to(`live-session:${liveSessionId}`)
      .emit("moderation-action", payload);
  }
}

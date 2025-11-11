import { Server as SocketIOServer, Socket } from 'socket.io';
import { db } from './db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';

let io: SocketIOServer | null = null;

// Rate limiting for socket connections (prevent DoS)
const connectionAttempts = new Map<string, { count: number; firstAttempt: number }>();
const MAX_CONNECTIONS_PER_IP = 10; // Max 10 connections per IP per minute
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute

// User cache to avoid repeated DB lookups (cache for 5 minutes)
const userCache = new Map<number, { user: any; cachedAt: number }>();
const USER_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const attempt = connectionAttempts.get(ip);

  if (!attempt) {
    connectionAttempts.set(ip, { count: 1, firstAttempt: now });
    return false;
  }

  // Reset if outside window
  if (now - attempt.firstAttempt > RATE_LIMIT_WINDOW) {
    connectionAttempts.set(ip, { count: 1, firstAttempt: now });
    return false;
  }

  // Increment and check limit
  attempt.count++;
  if (attempt.count > MAX_CONNECTIONS_PER_IP) {
    return true;
  }

  return false;
}

function getCachedUser(userId: number) {
  const cached = userCache.get(userId);
  if (cached && Date.now() - cached.cachedAt < USER_CACHE_TTL) {
    return cached.user;
  }
  return null;
}

function cacheUser(userId: number, user: any) {
  userCache.set(userId, { user, cachedAt: Date.now() });
}

/**
 * Initialize the WebSocket server with session-based authentication
 */
export function initializeWebSocket(socketServer: SocketIOServer) {
  io = socketServer;
  console.log('WebSocket service initialized');

  // Set up event handlers
  io.on('connection', async (socket) => {
    // Rate limiting by IP to prevent DoS
    const clientIp = socket.handshake.address || 'unknown';
    if (isRateLimited(clientIp)) {
      console.warn(`[SOCKET.IO] Rate limit exceeded for IP: ${clientIp}`);
      socket.emit('auth_error', { message: 'Too many connection attempts. Please try again later.' });
      socket.disconnect();
      return;
    }

    // Authenticate via session (socket.request.session set by middleware in routes.ts)
    const session = (socket.request as any).session;
    
    if (!session || !session.userId) {
      console.warn(`[SOCKET.IO] Unauthorized connection attempt from IP: ${clientIp}`, socket.id);
      socket.emit('auth_error', { message: 'Authentication required' });
      socket.disconnect();
      return;
    }

    // Check cache first to avoid DB query spam
    let user = getCachedUser(session.userId);
    
    if (!user) {
      // Cache miss - fetch from database
      const [dbUser] = await db
        .select()
        .from(users)
        .where(eq(users.id, session.userId))
        .limit(1);

      if (!dbUser || !dbUser.isActive) {
        console.warn(`[SOCKET.IO] Invalid or inactive user (ID: ${session.userId})`, socket.id);
        socket.emit('auth_error', { message: 'Invalid session' });
        socket.disconnect();
        return;
      }

      user = dbUser;
      cacheUser(user.id, user);
    }

    // Attach user info to socket for later use
    (socket as any).userId = user.id;
    (socket as any).userRole = user.role;

    console.log(`[SOCKET.IO] Client connected (authenticated): ${socket.id}, User: ${user.username} (${user.role})`);

    // Join monitoring room (authenticated users only)
    socket.on('join_monitoring', () => {
      socket.join('monitoring');
      console.log(`Socket ${socket.id} (User: ${user.username}) joined monitoring room`);
    });

    // Leave monitoring room
    socket.on('leave_monitoring', () => {
      socket.leave('monitoring');
      console.log(`Socket ${socket.id} left monitoring room`);
    });

    // Join a specific conversation room (for live chat participants)
    socket.on('join_conversation', (conversationId: number) => {
      socket.join(`conversation:${conversationId}`);
      console.log(`Socket ${socket.id} joined conversation ${conversationId}`);
    });

    // Leave a conversation room
    socket.on('leave_conversation', (conversationId: number) => {
      socket.leave(`conversation:${conversationId}`);
      console.log(`Socket ${socket.id} left conversation ${conversationId}`);
    });

    // Handle typing indicator events from clients
    socket.on('typing_start', (data: { conversationId: number; username: string }) => {
      // Broadcast typing status to all other clients in the conversation
      socket.to(`conversation:${data.conversationId}`).emit('user_typing', {
        conversationId: data.conversationId,
        username: data.username,
        isTyping: true,
      });
    });

    socket.on('typing_stop', (data: { conversationId: number; username: string }) => {
      // Broadcast typing stopped to all other clients in the conversation
      socket.to(`conversation:${data.conversationId}`).emit('user_typing', {
        conversationId: data.conversationId,
        username: data.username,
        isTyping: false,
      });
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected from conversation monitoring:', socket.id);
    });
  });
}

/**
 * Broadcast new message to monitoring dashboard AND to the conversation room
 */
export function broadcastNewMessage(conversationId: number, message: any) {
  if (!io) {
    console.warn('WebSocket not initialized, cannot broadcast message');
    return;
  }

  // Broadcast to monitoring dashboard
  io.to('monitoring').emit('new_message', {
    conversationId,
    message,
  });

  // Broadcast to the conversation room (for live chat participants)
  io.to(`conversation:${conversationId}`).emit('conversation_message', {
    id: message.id,
    content: message.content,
    sender: message.sender,
    timestamp: message.timestamp,
  });
}

/**
 * Broadcast conversation status update
 */
export function broadcastConversationUpdate(conversation: any) {
  if (!io) {
    console.warn('WebSocket not initialized, cannot broadcast conversation update');
    return;
  }

  io.to('monitoring').emit('conversation_updated', conversation);
}

/**
 * Broadcast new conversation created
 */
export function broadcastNewConversation(conversation: any) {
  if (!io) {
    console.warn('WebSocket not initialized, cannot broadcast new conversation');
    return;
  }

  io.to('monitoring').emit('new_conversation', conversation);
}

/**
 * Broadcast control mode change (takeover/handoff)
 */
export function broadcastControlModeChange(conversationId: number, controlMode: string, assignedAgent: string | null) {
  if (!io) {
    console.warn('WebSocket not initialized, cannot broadcast control mode change');
    return;
  }

  io.to('monitoring').emit('control_mode_changed', {
    conversationId,
    controlMode,
    assignedAgent,
  });
}

/**
 * Broadcast behavior settings update
 */
export function broadcastBehaviorUpdate(conversationId: number, behaviorSettings: any) {
  if (!io) {
    console.warn('WebSocket not initialized, cannot broadcast behavior update');
    return;
  }

  io.to('monitoring').emit('behavior_updated', {
    conversationId,
    behaviorSettings,
  });
}

/**
 * Broadcast typing indicator (for AI or server-side typing)
 */
export function broadcastTypingIndicator(conversationId: number, username: string, isTyping: boolean) {
  if (!io) {
    console.warn('WebSocket not initialized, cannot broadcast typing indicator');
    return;
  }

  io.to(`conversation:${conversationId}`).emit('user_typing', {
    conversationId,
    username,
    isTyping,
  });
}

export function getWebSocketServer() {
  return io;
}

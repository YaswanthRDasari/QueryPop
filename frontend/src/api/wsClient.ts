import { v4 as uuidv4 } from 'uuid';

type MessageType =
    | 'runQuery' | 'cancelQuery' | 'ping'
    | 'queryAccepted' | 'queryProgress' | 'queryRows' | 'queryDone' | 'queryError' | 'queryCanceled' | 'pong';

interface WsMessage {
    type: MessageType;
    requestId?: string;
    payload: any;
}

type MessageHandler = (payload: any) => void;

class SqlWebSocketClient {
    private ws: WebSocket | null = null;
    private url: string;
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 5;
    private listeners: Map<string, Set<MessageHandler>> = new Map();
    private pendingRequests: Map<string, { resolve: (val: any) => void, reject: (err: any) => void }> = new Map();
    private isConnected = false;

    constructor(baseUrl: string) {
        // Handle http/https to ws/wss conversion
        const protocol = baseUrl.startsWith('https') ? 'wss' : 'ws';
        const host = baseUrl.replace(/^https?:\/\//, '');
        this.url = `${protocol}://${host}/ws`;
    }

    connect(token?: string) {
        const fullUrl = token ? `${this.url}?token=${token}` : this.url;

        console.log(`Connecting to WebSocket: ${fullUrl}`);
        this.ws = new WebSocket(fullUrl);

        this.ws.onopen = () => {
            console.log('WebSocket Connected');
            this.isConnected = true;
            this.reconnectAttempts = 0;
            this.startKeepAlive();
        };

        this.ws.onclose = () => {
            console.log('WebSocket Disconnected');
            this.isConnected = false;
            this.cleanup();
            this.attemptReconnect();
        };

        this.ws.onerror = (error) => {
            console.error('WebSocket Error', error);
        };

        this.ws.onmessage = (event) => {
            try {
                const message: WsMessage = JSON.parse(event.data);
                this.handleMessage(message);
            } catch (e) {
                console.error('Failed to parse WS message', e);
            }
        };
    }

    private handleMessage(message: WsMessage) {
        // Handle Callbacks by QueryId (if present in payload)
        if (message.payload && message.payload.queryId) {
            this.emit(message.payload.queryId, message);
        }

        // Handle Request/Response by RequestId
        if (message.requestId && this.pendingRequests.has(message.requestId)) {
            // For now, only 'queryAccepted' might be a direct response to 'runQuery' with requestId
            // But streaming messages don't match requestId usually, they match queryId.
            // So we mostly define protocol: runQuery returns queryId immediately? 
            // Our backend sends "queryAccepted" with requestId.
            const { resolve } = this.pendingRequests.get(message.requestId)!;
            if (message.type === 'queryAccepted') {
                resolve(message.payload.queryId);
                this.pendingRequests.delete(message.requestId);
            }
        }
    }

    private emit(queryId: string, message: WsMessage) {
        if (this.listeners.has(queryId)) {
            this.listeners.get(queryId)!.forEach(handler => handler(message));
        }
    }

    subscribe(queryId: string, handler: MessageHandler) {
        if (!this.listeners.has(queryId)) {
            this.listeners.set(queryId, new Set());
        }
        this.listeners.get(queryId)!.add(handler);

        return () => {
            const handlers = this.listeners.get(queryId);
            if (handlers) {
                handlers.delete(handler);
                if (handlers.size === 0) {
                    this.listeners.delete(queryId);
                }
            }
        };
    }

    async runQuery(sql: string): Promise<string> {
        return new Promise((resolve, reject) => {
            if (!this.isConnected || !this.ws) {
                reject(new Error("WebSocket not connected"));
                return;
            }

            const requestId = uuidv4();
            this.pendingRequests.set(requestId, { resolve, reject });

            this.send({
                type: 'runQuery',
                requestId,
                payload: { sql }
            });

            // Timeout if no accept received
            setTimeout(() => {
                if (this.pendingRequests.has(requestId)) {
                    this.pendingRequests.delete(requestId);
                    reject(new Error("Query request timed out"));
                }
            }, 5000);
        });
    }

    cancelQuery(queryId: string) {
        this.send({
            type: 'cancelQuery',
            payload: { queryId }
        });
    }

    private send(message: WsMessage) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        }
    }

    private attemptReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            const timeout = Math.min(1000 * (2 ** this.reconnectAttempts), 10000);
            this.reconnectAttempts++;
            setTimeout(() => this.connect(), timeout);
        }
    }

    private keepAliveInterval: any;
    private startKeepAlive() {
        this.stopKeepAlive();
        this.keepAliveInterval = setInterval(() => {
            this.send({ type: 'ping', payload: {} });
        }, 30000);
    }

    private stopKeepAlive() {
        if (this.keepAliveInterval) clearInterval(this.keepAliveInterval);
    }

    private cleanup() {
        this.stopKeepAlive();
    }
}

// Singleton instance
// Assuming backend is on same host port 5000 generally, but let's make it configurable or relative
// For MVP, hardcode or use window.location
export const wsClient = new SqlWebSocketClient('http://localhost:5000');

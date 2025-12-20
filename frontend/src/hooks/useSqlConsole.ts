import { useState, useEffect, useCallback, useRef } from 'react';
import { wsClient } from '../api/wsClient';

export interface SqlResult {
    columns: string[];
    rows: any[][];
    status: 'idle' | 'running' | 'done' | 'error' | 'canceled';
    error?: string;
    stats?: {
        elapsedMs: number;
        totalRows: number;
    };
    loadedRows: number;
}

export function useSqlConsole() {
    const [queryId, setQueryId] = useState<string | null>(null);
    const [result, setResult] = useState<SqlResult>({
        columns: [],
        rows: [],
        status: 'idle',
        loadedRows: 0
    });

    // Connect on mount
    useEffect(() => {
        wsClient.connect();
        // No disconnect on unmount for now to keep connection alive across tab switches if needed, 
        // but typically hooks should clean up listeners.
    }, []);

    const handleMessage = useCallback((message: any) => {
        switch (message.type) {
            case 'queryProgress':
                setResult(prev => ({ ...prev, status: 'running' }));
                break;
            case 'queryRows':
                setResult(prev => {
                    // Append new rows. 
                    // Note: Ideally use a functional update that handles large arrays efficiently 
                    // or virtualization. For MVP, concat is fine up to a few thousand rows.
                    const newRows = [...prev.rows, ...message.payload.rows];
                    return {
                        ...prev,
                        columns: message.payload.columns, // Update columns just in case
                        rows: newRows,
                        loadedRows: newRows.length
                    };
                });
                break;
            case 'queryDone':
                setResult(prev => ({
                    ...prev,
                    status: 'done',
                    stats: message.payload.stats
                }));
                break;
            case 'queryError':
                setResult(prev => ({
                    ...prev,
                    status: 'error',
                    error: message.payload.message
                }));
                break;
            case 'queryCanceled':
                setResult(prev => ({ ...prev, status: 'canceled' }));
                break;
        }
    }, []);

    const runQuery = async (sql: string) => {
        // Reset state
        setResult({
            columns: [],
            rows: [],
            status: 'running', // Optimistic set
            loadedRows: 0
        });

        try {
            const newQueryId = await wsClient.runQuery(sql);
            setQueryId(newQueryId);

            // Subscribe to this query
            const unsubscribe = wsClient.subscribe(newQueryId, handleMessage);

            // Only strictly need to unsubscribe when query changes or component unmounts.
            // But since we might run multiple queries, we should clean up the old one?
            // For now, `queryId` change triggers cleanup in useEffect below?
            // Actually, `runQuery` is an event. subscription is tied to the ID.

            // We need to store unsubscribe function to call it later
            return unsubscribe;
        } catch (e: any) {
            setResult(prev => ({
                ...prev,
                status: 'error',
                error: e.message
            }));
            return () => { };
        }
    };

    // Effect to manage subscription cleanup if we were to support component unmounting
    // holding the active query. But here we usually just replace the query.
    // Let's keep it simple: The user calls `runQuery`, we subscribe.
    // If they call `runQuery` again, the old subscription stays? No, we should clear it.

    const activeSubscriptionRef = useRef<(() => void) | null>(null);

    const run = async (sql: string) => {
        if (activeSubscriptionRef.current) {
            activeSubscriptionRef.current();
        }
        const unsub = await runQuery(sql);
        if (typeof unsub === 'function') {
            activeSubscriptionRef.current = unsub;
        }
    };

    const cancel = () => {
        if (queryId) {
            wsClient.cancelQuery(queryId);
        }
    };

    return {
        runQuery: run,
        cancelQuery: cancel,
        result
    };
}

import axios from 'axios';
import type { ConnectResponse, ExecuteResponse, GenerateResponse, QueryHistoryItem } from '../types';

const API_BASE_URL = 'http://localhost:5000/api';

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

export const dbApi = {
    checkHealth: async () => {
        return api.get('/health');
    },

    connect: async (connectionString: string): Promise<ConnectResponse> => {
        try {
            const response = await api.post('/connect', { connection_string: connectionString });
            return response.data;
        } catch (error: any) {
            return error.response?.data || { success: false, message: 'Network error' };
        }
    },

    generateQuery: async (question: string): Promise<GenerateResponse> => {
        try {
            const response = await api.post('/query/generate', { question });
            return response.data;
        } catch (error: any) {
            console.error(error);
            return {
                sql: '',
                explanation: '',
                confidence: 'low',
                error: error.response?.data?.error || 'Failed to generate query'
            };
        }
    },

    executeQuery: async (sql: string, question?: string): Promise<ExecuteResponse> => {
        try {
            const response = await api.post('/query/execute', { sql, question });
            return response.data;
        } catch (error: any) {
            return error.response?.data || { success: false, error: 'Execution failed' };
        }
    },

    getHistory: async (limit: number = 20): Promise<QueryHistoryItem[]> => {
        try {
            const response = await api.get('/query-history', { params: { limit } });
            return response.data;
        } catch (error) {
            console.error('Failed to fetch history', error);
            return [];
        }
    }
};

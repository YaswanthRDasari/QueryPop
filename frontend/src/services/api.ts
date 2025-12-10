import axios from 'axios';
import type { ConnectResponse, ExecuteResponse, GenerateResponse, QueryHistoryItem, TablesResponse, TableStructureResponse, TableDataResponse } from '../types';

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

// Table Management API
export const tableApi = {
    getTables: async (): Promise<TablesResponse> => {
        try {
            const response = await api.get('/tables');
            return response.data;
        } catch (error: any) {
            return { success: false, error: error.response?.data?.error || 'Failed to fetch tables' };
        }
    },

    getTableStructure: async (tableName: string): Promise<TableStructureResponse> => {
        try {
            const response = await api.get(`/tables/${tableName}/structure`);
            return response.data;
        } catch (error: any) {
            return { success: false, error: error.response?.data?.error || 'Failed to fetch structure' };
        }
    },

    getTableData: async (
        tableName: string,
        page: number = 1,
        perPage: number = 50,
        orderBy?: string,
        orderDir: 'asc' | 'desc' = 'asc'
    ): Promise<TableDataResponse> => {
        try {
            const response = await api.get(`/tables/${tableName}/data`, {
                params: { page, per_page: perPage, order_by: orderBy, order_dir: orderDir }
            });
            return response.data;
        } catch (error: any) {
            return { success: false, error: error.response?.data?.error || 'Failed to fetch data' };
        }
    },

    insertRow: async (tableName: string, data: Record<string, any>) => {
        try {
            const response = await api.post(`/tables/${tableName}/rows`, data);
            return response.data;
        } catch (error: any) {
            return { success: false, error: error.response?.data?.error || 'Insert failed' };
        }
    },

    updateRow: async (tableName: string, pkValue: string | number, pkColumn: string, data: Record<string, any>) => {
        try {
            const response = await api.put(`/tables/${tableName}/rows/${pkValue}`, data, {
                params: { pk_column: pkColumn }
            });
            return response.data;
        } catch (error: any) {
            return { success: false, error: error.response?.data?.error || 'Update failed' };
        }
    },

    deleteRow: async (tableName: string, pkValue: string | number, pkColumn: string) => {
        try {
            const response = await api.delete(`/tables/${tableName}/rows/${pkValue}`, {
                params: { pk_column: pkColumn }
            });
            return response.data;
        } catch (error: any) {
            return { success: false, error: error.response?.data?.error || 'Delete failed' };
        }
    }
};

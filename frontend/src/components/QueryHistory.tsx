import React from 'react';
import type { QueryHistoryItem } from '../types';
import { History, Clock, CheckCircle, AlertCircle } from 'lucide-react';

interface QueryHistoryProps {
    history: QueryHistoryItem[];
    onSelect: (sql: string) => void;
}

export const QueryHistory: React.FC<QueryHistoryProps> = ({ history, onSelect }) => {
    return (
        <div className="w-80 border-r border-slate-200 h-screen bg-slate-50 flex flex-col shrink-0">
            <div className="p-4 border-b border-slate-200 bg-white">
                <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <History size={16} />
                    Query History
                </h2>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2">
                {history.length === 0 ? (
                    <div className="text-center text-slate-400 text-xs py-8">
                        No queries yet
                    </div>
                ) : (
                    history.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => onSelect(item.sql)}
                            className="w-full text-left p-3 rounded-lg border border-slate-200 bg-white hover:border-primary-300 hover:shadow-sm transition-all group group-hover:bg-slate-50"
                        >
                            <div className="flex justify-between items-start mb-1">
                                <span className="text-xs text-slate-400 flex items-center gap-1">
                                    <Clock size={10} />
                                    {new Date(item.timestamp).toLocaleTimeString()}
                                </span>
                                {item.status === 'success' ? (
                                    <CheckCircle size={12} className="text-emerald-500" />
                                ) : (
                                    <AlertCircle size={12} className="text-red-500" />
                                )}
                            </div>
                            <p className="text-sm text-slate-700 font-medium line-clamp-2 mb-1 group-hover:text-primary-700">
                                {item.question || item.sql}
                            </p>
                            <div className="flex gap-2 text-xs text-slate-400">
                                {item.row_count !== undefined && (
                                    <span>{item.row_count} rows</span>
                                )}
                                {item.execution_time_ms && (
                                    <span>{item.execution_time_ms.toFixed(0)}ms</span>
                                )}
                            </div>
                        </button>
                    ))
                )}
            </div>
        </div>
    );
};

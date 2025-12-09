import React from 'react';
import type { ExecuteResponse } from '../types';

interface ResultsTableProps {
    result: ExecuteResponse | null;
}

export const ResultsTable: React.FC<ResultsTableProps> = ({ result }) => {
    if (!result || !result.success || !result.rows) {
        if (result?.error) {
            return (
                <div className="bg-red-50 text-red-700 p-4 rounded-lg border border-red-200 mt-4">
                    <p className="font-semibold">Query Failed</p>
                    <p className="text-sm mt-1 font-mono">{result.error}</p>
                </div>
            );
        }
        return null;
    }

    if (result.rows.length === 0) {
        return (
            <div className="bg-slate-50 text-slate-500 p-8 rounded-lg border border-slate-200 mt-4 text-center">
                No results found.
            </div>
        );
    }

    const columns = result.columns || Object.keys(result.rows[0]);

    return (
        <div className="mt-4 rounded-lg border border-slate-200 overflow-hidden shadow-sm bg-white">
            <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 flex justify-between items-center">
                <span className="text-sm text-slate-600 font-medium">
                    {result.row_count} rows in {result.execution_time_ms?.toFixed(0)}ms
                </span>
            </div>
            <div className="overflow-x-auto custom-scrollbar max-h-[500px]">
                <table className="w-full text-sm text-left">
                    <thead className="text-xs text-slate-500 uppercase bg-slate-50 sticky top-0 z-10">
                        <tr>
                            {columns.map((col) => (
                                <th key={col} className="px-6 py-3 font-medium whitespace-nowrap border-b border-slate-100">
                                    {col}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {result.rows.map((row, i) => (
                            <tr key={i} className="hover:bg-slate-50 border-b border-slate-100 last:border-0">
                                {columns.map((col) => (
                                    <td key={col} className="px-6 py-3 whitespace-nowrap text-slate-700 font-mono text-xs">
                                        {String(row[col])}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

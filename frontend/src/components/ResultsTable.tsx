import React from 'react';
import type { ExecuteResponse } from '../types';

interface ResultsTableProps {
    result: ExecuteResponse | null;
    tableName?: string;
    primaryKey?: string;
    onCellUpdate?: (rowId: string | number, field: string, value: string) => Promise<void>;
}

export const ResultsTable: React.FC<ResultsTableProps> = ({ result, tableName, primaryKey, onCellUpdate }) => {
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

    // Editing State
    const [editingCell, setEditingCell] = React.useState<{ rowId: string | number, field: string } | null>(null);
    const [editingValue, setEditingValue] = React.useState('');

    const handleCellClick = (row: any, field: string, value: any) => {
        if (!tableName || !primaryKey || !onCellUpdate) return;

        const rowId = row[primaryKey];
        if (rowId === undefined) return;

        setEditingCell({ rowId, field });
        setEditingValue(value === null ? '' : String(value));
    };

    const saveCellEdit = async () => {
        if (!editingCell || !onCellUpdate) return;

        // Find current value
        const { rowId, field } = editingCell;

        await onCellUpdate(rowId, field, editingValue);
        setEditingCell(null);
        setEditingValue('');
    };

    return (
        <div className="mt-4 rounded-lg border border-slate-200 overflow-hidden shadow-sm bg-white">
            <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 flex justify-between items-center">
                <span className="text-sm text-slate-600 font-medium">
                    {result.row_count} rows in {result.execution_time_ms?.toFixed(0)}ms
                </span>
            </div>
            <div className="overflow-x-auto custom-scrollbar">
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
                        {result.rows.map((row, i) => {
                            // Try to find a unique ID for the key if primaryKey is not available, fallback to index
                            const rowKey = primaryKey && row[primaryKey] ? row[primaryKey] : i;

                            return (
                                <tr key={rowKey} className="hover:bg-slate-50 border-b border-slate-100 last:border-0">
                                    {columns.map((col) => {
                                        const isEditing = editingCell?.rowId === row[primaryKey] && editingCell?.field === col;
                                        const val = row[col];

                                        return (
                                            <td
                                                key={col}
                                                className={`px-6 py-3 whitespace-nowrap text-slate-700 font-mono text-xs ${tableName && primaryKey && col !== primaryKey ? 'cursor-pointer' : ''} ${isEditing ? 'p-0' : ''}`}
                                                onClick={() => !isEditing && col !== primaryKey && handleCellClick(row, col, val)}
                                            >
                                                {isEditing ? (
                                                    <input
                                                        autoFocus
                                                        value={editingValue}
                                                        onChange={e => setEditingValue(e.target.value)}
                                                        onBlur={saveCellEdit}
                                                        onKeyDown={e => {
                                                            if (e.key === 'Enter') {
                                                                e.preventDefault();
                                                                saveCellEdit();
                                                            }
                                                            if (e.key === 'Escape') {
                                                                setEditingCell(null);
                                                                setEditingValue('');
                                                            }
                                                        }}
                                                        className="w-full h-full px-2 py-1 border-2 border-primary-500 outline-none"
                                                    />
                                                ) : (
                                                    // Raw value display with Timestamp Hover (reused logic)
                                                    (() => {
                                                        let titleHex = undefined;
                                                        const numVal = Number(val);
                                                        if (val !== null && !isNaN(numVal) && typeof val !== 'boolean') {
                                                            if (numVal > 946684800 && numVal < 4102444800) {
                                                                titleHex = `Epoch (s): ${new Date(numVal * 1000).toLocaleString()}`;
                                                            } else if (numVal > 946684800000 && numVal < 4102444800000) {
                                                                titleHex = `Epoch (ms): ${new Date(numVal).toLocaleString()}`;
                                                            }
                                                        }
                                                        return (
                                                            <span
                                                                className={val === null ? "text-slate-400 italic" : ""}
                                                                title={titleHex}
                                                            >
                                                                {val === null ? "NULL" : String(val)}
                                                            </span>
                                                        );
                                                    })()
                                                )}
                                            </td>
                                        );
                                    })}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

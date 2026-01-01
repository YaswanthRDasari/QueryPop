import React, { useState, useEffect } from 'react';
import type { ExecuteResponse } from '../types';
import { ChevronLeft, ChevronRight, Pencil, Save, X } from 'lucide-react';
import { message } from 'antd';

interface ResultsTableProps {
    result: ExecuteResponse | null;
    tableName?: string;
    primaryKey?: string;
    onCellUpdate?: (rowId: string | number, field: string, value: string) => Promise<void>;
    onRowUpdate?: (rowId: string | number, data: Record<string, any>) => Promise<void>;
}

export const ResultsTable: React.FC<ResultsTableProps> = ({ result, tableName, primaryKey, onCellUpdate, onRowUpdate }) => {
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

    // Editing State (Cell)
    const [editingCell, setEditingCell] = React.useState<{ rowId: string | number, field: string } | null>(null);
    const [editingValue, setEditingValue] = React.useState('');

    // Editing State (Row)
    const [editingRowId, setEditingRowId] = useState<string | number | null>(null);
    const [editingRowData, setEditingRowData] = useState<Record<string, any>>({});

    const handleCellClick = (row: any, field: string, value: any) => {
        if (!tableName || !primaryKey || !onCellUpdate) return;
        if (editingRowId !== null) return; // Disable cell click if row editing is active

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

    // Row Editing Handlers
    const startRowEdit = (row: any) => {
        if (!primaryKey) return;
        const rowId = row[primaryKey];
        if (rowId === undefined) return;

        setEditingRowId(rowId);
        // Clone row for editing, handling nulls
        const rowData: Record<string, any> = {};
        Object.keys(row).forEach(key => {
            rowData[key] = row[key] === null ? '' : row[key];
        });
        setEditingRowData(rowData);
        setEditingCell(null);
    };

    const cancelRowEdit = () => {
        setEditingRowId(null);
        setEditingRowData({});
    };

    const saveRowEdit = async () => {
        if (!editingRowId || !onRowUpdate) return;

        try {
            await onRowUpdate(editingRowId, editingRowData);
            setEditingRowId(null);
            setEditingRowData({});
            message.success('Row updated successfully');
        } catch (error) {
            console.error('Failed to save row', error);
            message.error('Failed to update row');
        }
    };

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(20);

    // Reset pagination when result changes
    useEffect(() => {
        setCurrentPage(1);
    }, [result]);

    // Calculate displayed rows
    const totalRows = result.rows.length;
    const totalPages = Math.ceil(totalRows / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const currentRows = result.rows.slice(startIndex, endIndex);

    return (
        <div className="mt-4 rounded-lg border border-slate-200 overflow-hidden shadow-sm bg-white flex flex-col">
            <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 flex justify-between items-center">
                <div className="bg-green-50 border border-green-200 text-green-800 px-3 py-2 rounded text-xs flex items-center gap-2">
                    <span className="font-bold">✓</span>
                    <span>
                        Showing rows {startIndex + 1}-{Math.min(endIndex, totalRows)} ({totalRows} total, Query took {result.execution_time_ms ? (result.execution_time_ms / 1000).toFixed(4) : '0.00'} seconds.)
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">Rows per page:</span>
                    <select
                        value={itemsPerPage}
                        onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                        className="text-xs border border-slate-300 rounded px-1 py-0.5 bg-white focus:outline-none focus:border-primary-500"
                    >
                        {[20, 25, 50, 100, 200, 500].map(size => (
                            <option key={size} value={size}>{size}</option>
                        ))}
                    </select>
                </div>
            </div>
            <div className="overflow-x-auto custom-scrollbar flex-1">
                <table className="w-full text-sm text-left">
                    <thead className="text-xs text-slate-500 uppercase bg-slate-50 sticky top-0 z-10 shadow-sm">
                        <tr>
                            {tableName && primaryKey && onRowUpdate && (
                                <th className="px-4 py-3 font-medium whitespace-nowrap border-b border-slate-100 bg-slate-50 w-20">
                                    Actions
                                </th>
                            )}
                            {columns.map((col) => (
                                <th key={col} className="px-6 py-3 font-medium whitespace-nowrap border-b border-slate-100 bg-slate-50">
                                    {col}
                                    {col === primaryKey && <span className="ml-1 text-primary-500">🔑</span>}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {currentRows.map((row, i) => {
                            // Try to find a unique ID for the key if primaryKey is not available, fallback to index
                            const rowId = primaryKey && row[primaryKey];
                            const rowKey = rowId !== undefined ? rowId : startIndex + i;
                            const isRowEditing = editingRowId === rowId;

                            return (
                                <tr key={rowKey} className={`border-b border-slate-100 last:border-0 transition-colors ${isRowEditing ? 'bg-blue-50' : 'hover:bg-slate-50 group'}`}>
                                    {tableName && primaryKey && onRowUpdate && (
                                        <td className="px-4 py-2 whitespace-nowrap">
                                            {isRowEditing ? (
                                                <div className="flex gap-2">
                                                    <button onClick={saveRowEdit} className="text-green-600 hover:text-green-700 p-1 rounded hover:bg-green-100">
                                                        <Save size={16} />
                                                    </button>
                                                    <button onClick={cancelRowEdit} className="text-red-500 hover:text-red-600 p-1 rounded hover:bg-red-100">
                                                        <X size={16} />
                                                    </button>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => startRowEdit(row)}
                                                    className="text-slate-400 hover:text-blue-600 p-1 rounded hover:bg-blue-50 opacity-0 group-hover:opacity-100 transition-opacity"
                                                    title="Edit Row"
                                                >
                                                    <Pencil size={14} />
                                                </button>
                                            )}
                                        </td>
                                    )}
                                    {columns.map((col) => {
                                        // Row Edit Logic
                                        if (isRowEditing) {
                                            const isPk = col === primaryKey;
                                            return (
                                                <td key={col} className="px-6 py-3 whitespace-nowrap">
                                                    <input
                                                        value={editingRowData[col] || ''}
                                                        onChange={(e) => setEditingRowData(prev => ({ ...prev, [col]: e.target.value }))}
                                                        disabled={isPk}
                                                        className={`w-full px-2 py-1 text-xs border rounded outline-none ${isPk ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'bg-white border-blue-300 focus:border-blue-500'}`}
                                                    />
                                                </td>
                                            );
                                        }

                                        // Cell Edit Logic
                                        const isEditing = primaryKey && editingCell?.rowId === rowId && editingCell?.field === col;
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

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-500 mr-2">
                            Page {currentPage} of {totalPages}
                        </span>
                    </div>

                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setCurrentPage(1)}
                            disabled={currentPage === 1}
                            className="p-1 border rounded hover:bg-white disabled:opacity-50 text-slate-500"
                            title="First Page"
                        >
                            <span style={{ fontSize: '10px' }}>&laquo;</span>
                        </button>
                        <button
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="p-1 border rounded hover:bg-white disabled:opacity-50 text-slate-500"
                            title="Previous Page"
                        >
                            <ChevronLeft size={16} />
                        </button>

                        <div className="flex items-center gap-1 mx-2">
                            {/* Simple sliding window pagination logic */}
                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                let p = i + 1;
                                if (totalPages > 5) {
                                    if (currentPage <= 3) { p = i + 1; }
                                    else if (currentPage >= totalPages - 2) { p = totalPages - 4 + i; }
                                    else { p = currentPage - 2 + i; }
                                }
                                return (
                                    <button
                                        key={p}
                                        onClick={() => setCurrentPage(p)}
                                        disabled={p === currentPage}
                                        className={`w-8 h-8 flex items-center justify-center rounded border text-sm transition-colors ${p === currentPage
                                            ? 'bg-primary-600 text-white border-primary-600 font-medium'
                                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                                            }`}
                                    >
                                        {p}
                                    </button>
                                );
                            })}
                        </div>

                        <button
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            className="p-1 border rounded hover:bg-white disabled:opacity-50 text-slate-500"
                            title="Next Page"
                        >
                            <ChevronRight size={16} />
                        </button>
                        <button
                            onClick={() => setCurrentPage(totalPages)}
                            disabled={currentPage === totalPages}
                            className="p-1 border rounded hover:bg-white disabled:opacity-50 text-slate-500"
                            title="Last Page"
                        >
                            <span style={{ fontSize: '10px' }}>&raquo;</span>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

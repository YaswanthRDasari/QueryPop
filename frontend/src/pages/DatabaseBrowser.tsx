import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { tableApi } from '../services/api';
import type { TableInfo, TableDataResponse, ColumnInfo } from '../types';
import { Database, Table, Columns, RefreshCw, ChevronLeft, ChevronRight, Plus, Trash2, Pencil, Save, X, Loader2, Download, FileText, FileCode, Upload } from 'lucide-react';

export const DatabaseBrowser: React.FC = () => {
    const navigate = useNavigate();
    const [tables, setTables] = useState<TableInfo[]>([]);
    const [selectedTable, setSelectedTable] = useState<string | null>(null);
    const [tableData, setTableData] = useState<TableDataResponse | null>(null);
    const [tableStructure, setTableStructure] = useState<ColumnInfo[]>([]);
    const [primaryKeys, setPrimaryKeys] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [perPage] = useState(25);

    // Editing state
    const [editingRowPk, setEditingRowPk] = useState<string | number | null>(null);
    const [editingData, setEditingData] = useState<Record<string, any>>({});
    const [isAddingRow, setIsAddingRow] = useState(false);
    const [newRowData, setNewRowData] = useState<Record<string, any>>({});
    const [showExportMenu, setShowExportMenu] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [importResult, setImportResult] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const hasFetchedTables = useRef(false);

    useEffect(() => {
        if (hasFetchedTables.current) return;
        hasFetchedTables.current = true;

        const fetchTables = async () => {
            setLoading(true);
            const result = await tableApi.getTables();
            if (result.success && result.tables) {
                setTables(result.tables);
                if (result.tables.length > 0) {
                    setSelectedTable(result.tables[0].name);
                }
            } else {
                setError(result.error || 'Failed to load tables');
            }
            setLoading(false);
        };

        fetchTables();
    }, []);

    useEffect(() => {
        if (selectedTable) {
            loadTableData(selectedTable, page);
            loadTableStructure(selectedTable);
        }
    }, [selectedTable, page]);

    const loadTables = async () => {
        setLoading(true);
        const result = await tableApi.getTables();
        if (result.success && result.tables) {
            setTables(result.tables);
            if (result.tables.length > 0 && !selectedTable) {
                setSelectedTable(result.tables[0].name);
            }
        } else {
            setError(result.error || 'Failed to load tables');
        }
        setLoading(false);
    };

    const loadTableData = async (tableName: string, pageNum: number) => {
        setLoading(true);
        const result = await tableApi.getTableData(tableName, pageNum, perPage);
        if (result.success) {
            setTableData(result);
        } else {
            setError(result.error || 'Failed to load data');
        }
        setLoading(false);
    };

    const loadTableStructure = async (tableName: string) => {
        const result = await tableApi.getTableStructure(tableName);
        if (result.success && result.columns) {
            setTableStructure(result.columns);
            setPrimaryKeys(result.primary_keys || []);
        }
    };

    const handleTableSelect = (tableName: string) => {
        setSelectedTable(tableName);
        setPage(1);
        setEditingRowPk(null);
        setIsAddingRow(false);
    };

    const getPrimaryKeyValue = (row: Record<string, any>): string | number => {
        if (primaryKeys.length > 0) {
            return row[primaryKeys[0]];
        }
        // Fallback to id or first column
        return row['id'] || row[Object.keys(row)[0]];
    };

    const getPrimaryKeyColumn = (): string => {
        if (primaryKeys.length > 0) {
            return primaryKeys[0];
        }
        return 'id';
    };

    // Edit handlers
    const startEditing = (row: Record<string, any>) => {
        setEditingRowPk(getPrimaryKeyValue(row));
        setEditingData({ ...row });
    };

    const cancelEditing = () => {
        setEditingRowPk(null);
        setEditingData({});
    };

    const saveEdit = async () => {
        if (!selectedTable || editingRowPk === null) return;

        const result = await tableApi.updateRow(selectedTable, editingRowPk, getPrimaryKeyColumn(), editingData);
        if (result.success) {
            await loadTableData(selectedTable, page);
            setEditingRowPk(null);
            setEditingData({});
        } else {
            setError(result.error || 'Update failed');
        }
    };

    // Add row handlers
    const startAddingRow = () => {
        const emptyRow: Record<string, any> = {};
        tableStructure.forEach(col => {
            emptyRow[col.name] = '';
        });
        setNewRowData(emptyRow);
        setIsAddingRow(true);
    };

    const cancelAddingRow = () => {
        setIsAddingRow(false);
        setNewRowData({});
    };

    const saveNewRow = async () => {
        if (!selectedTable) return;

        // Filter out empty/auto-increment fields
        const dataToInsert: Record<string, any> = {};
        Object.entries(newRowData).forEach(([key, value]) => {
            const col = tableStructure.find(c => c.name === key);
            if (col && !col.autoincrement && value !== '') {
                dataToInsert[key] = value;
            }
        });

        const result = await tableApi.insertRow(selectedTable, dataToInsert);
        if (result.success) {
            await loadTableData(selectedTable, page);
            setIsAddingRow(false);
            setNewRowData({});
        } else {
            setError(result.error || 'Insert failed');
        }
    };

    // Delete handler
    const deleteRow = async (row: Record<string, any>) => {
        if (!selectedTable) return;
        if (!confirm('Are you sure you want to delete this row?')) return;

        const pkValue = getPrimaryKeyValue(row);
        const result = await tableApi.deleteRow(selectedTable, pkValue, getPrimaryKeyColumn());
        if (result.success) {
            await loadTableData(selectedTable, page);
        } else {
            setError(result.error || 'Delete failed');
        }
    };

    // Import handler
    const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsImporting(true);
        setImportResult(null);

        try {
            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch('http://localhost:5000/api/import/sql', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (result.success) {
                setImportResult(`✓ Imported ${result.statements_executed} statements`);
                await loadTables();
                if (selectedTable) {
                    await loadTableData(selectedTable, page);
                }
            } else {
                setError(result.error || 'Import failed');
            }
        } catch (err) {
            setError('Import failed');
        } finally {
            setIsImporting(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    return (
        <div className="flex h-screen bg-slate-100">
            {/* Sidebar - Table List */}
            <div className="w-64 bg-white border-r border-slate-200 flex flex-col">
                <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Database className="text-primary-600" size={20} />
                        <h1 className="font-bold text-slate-800">QueryPop</h1>
                    </div>
                    <button onClick={loadTables} className="p-1 hover:bg-slate-100 rounded">
                        <RefreshCw size={16} className="text-slate-500" />
                    </button>
                </div>

                <div className="p-3 border-b border-slate-100">
                    <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Tables</h2>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {tables.map(table => (
                        <button
                            key={table.name}
                            onClick={() => handleTableSelect(table.name)}
                            className={`w-full text-left px-4 py-2 flex items-center gap-2 hover:bg-slate-50 border-l-2 transition-colors ${selectedTable === table.name
                                ? 'bg-primary-50 border-primary-500 text-primary-700'
                                : 'border-transparent text-slate-700'
                                }`}
                        >
                            <Table size={14} className="shrink-0" />
                            <span className="truncate text-sm">{table.name}</span>
                            <span className="ml-auto text-xs text-slate-400">{table.column_count}</span>
                        </button>
                    ))}
                </div>

                <div className="p-3 border-t border-slate-200">
                    <button
                        onClick={() => navigate('/query')}
                        className="w-full text-sm text-slate-600 hover:text-primary-600 py-2"
                    >
                        ← AI Query Mode
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Header */}
                <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Columns size={20} className="text-slate-500" />
                        <h2 className="text-lg font-semibold text-slate-800">{selectedTable || 'Select a table'}</h2>
                        {tableData?.pagination && (
                            <span className="text-sm text-slate-500">
                                ({tableData.pagination.total_count} rows)
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Export Dropdown */}
                        <div className="relative">
                            <button
                                onClick={() => setShowExportMenu(!showExportMenu)}
                                disabled={!selectedTable}
                                className="border border-slate-300 hover:bg-slate-50 px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-50"
                            >
                                <Download size={16} />
                                Export
                            </button>
                            {showExportMenu && selectedTable && (
                                <div className="absolute right-0 mt-1 w-48 bg-white border border-slate-200 rounded-lg shadow-lg z-10">
                                    <a
                                        href={`http://localhost:5000/api/tables/${selectedTable}/export/csv`}
                                        className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                                        onClick={() => setShowExportMenu(false)}
                                    >
                                        <FileText size={14} />
                                        Export as CSV
                                    </a>
                                    <a
                                        href={`http://localhost:5000/api/tables/${selectedTable}/export/sql`}
                                        className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                                        onClick={() => setShowExportMenu(false)}
                                    >
                                        <FileCode size={14} />
                                        Export as SQL
                                    </a>
                                    <hr className="border-slate-200" />
                                    <a
                                        href="http://localhost:5000/api/export/database"
                                        className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                                        onClick={() => setShowExportMenu(false)}
                                    >
                                        <Database size={14} />
                                        Export All Tables
                                    </a>
                                </div>
                            )}
                        </div>

                        {/* Import Button */}
                        <div className="relative">
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleImportFile}
                                accept=".sql"
                                className="hidden"
                            />
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isImporting}
                                className="border border-slate-300 hover:bg-slate-50 px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-50"
                            >
                                {isImporting ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                                Import SQL
                            </button>
                        </div>

                        {/* Import Result */}
                        {importResult && (
                            <span className="text-sm text-green-600 bg-green-50 px-2 py-1 rounded">
                                {importResult}
                            </span>
                        )}

                        <button
                            onClick={startAddingRow}
                            disabled={!selectedTable || isAddingRow}
                            className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-50"
                        >
                            <Plus size={16} />
                            Add Row
                        </button>
                    </div>
                </div>

                {/* Error Display */}
                {error && (
                    <div className="mx-6 mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex justify-between items-center">
                        <span>{error}</span>
                        <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
                            <X size={16} />
                        </button>
                    </div>
                )}

                {/* Table View */}
                <div className="flex-1 overflow-auto p-6">
                    {loading ? (
                        <div className="flex items-center justify-center h-full">
                            <Loader2 className="animate-spin text-primary-600" size={32} />
                        </div>
                    ) : tableData?.rows && tableData.columns ? (
                        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-slate-50 border-b border-slate-200">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase w-24">Actions</th>
                                            {tableData.columns.map(col => (
                                                <th key={col} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">
                                                    {col}
                                                    {primaryKeys.includes(col) && <span className="ml-1 text-primary-500">🔑</span>}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {/* Add New Row Form */}
                                        {isAddingRow && (
                                            <tr className="bg-green-50 border-b border-green-200">
                                                <td className="px-4 py-2">
                                                    <div className="flex gap-1">
                                                        <button onClick={saveNewRow} className="p-1 text-green-600 hover:bg-green-100 rounded">
                                                            <Save size={14} />
                                                        </button>
                                                        <button onClick={cancelAddingRow} className="p-1 text-slate-500 hover:bg-slate-100 rounded">
                                                            <X size={14} />
                                                        </button>
                                                    </div>
                                                </td>
                                                {tableData.columns.map(col => {
                                                    const colInfo = tableStructure.find(c => c.name === col);
                                                    return (
                                                        <td key={col} className="px-4 py-2">
                                                            <input
                                                                type="text"
                                                                value={newRowData[col] || ''}
                                                                onChange={(e) => setNewRowData({ ...newRowData, [col]: e.target.value })}
                                                                disabled={colInfo?.autoincrement}
                                                                placeholder={colInfo?.autoincrement ? 'auto' : ''}
                                                                className="w-full px-2 py-1 border border-green-300 rounded text-sm disabled:bg-slate-100 disabled:text-slate-400"
                                                            />
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        )}

                                        {/* Data Rows */}
                                        {tableData.rows.map((row, idx) => {
                                            const pkValue = getPrimaryKeyValue(row);
                                            const isEditing = editingRowPk === pkValue;

                                            return (
                                                <tr key={idx} className={`border-b border-slate-100 hover:bg-slate-50 ${isEditing ? 'bg-blue-50' : ''}`}>
                                                    <td className="px-4 py-2">
                                                        <div className="flex gap-1">
                                                            {isEditing ? (
                                                                <>
                                                                    <button onClick={saveEdit} className="p-1 text-green-600 hover:bg-green-100 rounded">
                                                                        <Save size={14} />
                                                                    </button>
                                                                    <button onClick={cancelEditing} className="p-1 text-slate-500 hover:bg-slate-100 rounded">
                                                                        <X size={14} />
                                                                    </button>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <button onClick={() => startEditing(row)} className="p-1 text-blue-600 hover:bg-blue-100 rounded">
                                                                        <Pencil size={14} />
                                                                    </button>
                                                                    <button onClick={() => deleteRow(row)} className="p-1 text-red-600 hover:bg-red-100 rounded">
                                                                        <Trash2 size={14} />
                                                                    </button>
                                                                </>
                                                            )}
                                                        </div>
                                                    </td>
                                                    {tableData.columns!.map(col => (
                                                        <td key={col} className="px-4 py-2 text-slate-700 font-mono text-xs">
                                                            {isEditing ? (
                                                                <input
                                                                    type="text"
                                                                    value={editingData[col] ?? ''}
                                                                    onChange={(e) => setEditingData({ ...editingData, [col]: e.target.value })}
                                                                    disabled={primaryKeys.includes(col)}
                                                                    className="w-full px-2 py-1 border border-blue-300 rounded text-sm disabled:bg-slate-100"
                                                                />
                                                            ) : (
                                                                <span className="block truncate max-w-xs" title={String(row[col])}>
                                                                    {row[col] === null ? <span className="text-slate-400 italic">NULL</span> : String(row[col])}
                                                                </span>
                                                            )}
                                                        </td>
                                                    ))}
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination */}
                            {tableData.pagination && tableData.pagination.total_pages > 1 && (
                                <div className="px-4 py-3 border-t border-slate-200 flex items-center justify-between bg-slate-50">
                                    <span className="text-sm text-slate-600">
                                        Page {tableData.pagination.page} of {tableData.pagination.total_pages}
                                    </span>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setPage(p => Math.max(1, p - 1))}
                                            disabled={page === 1}
                                            className="px-3 py-1 border border-slate-300 rounded text-sm hover:bg-white disabled:opacity-50"
                                        >
                                            <ChevronLeft size={16} />
                                        </button>
                                        <button
                                            onClick={() => setPage(p => Math.min(tableData.pagination!.total_pages, p + 1))}
                                            disabled={page === tableData.pagination.total_pages}
                                            className="px-3 py-1 border border-slate-300 rounded text-sm hover:bg-white disabled:opacity-50"
                                        >
                                            <ChevronRight size={16} />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex items-center justify-center h-full text-slate-500">
                            Select a table to view data
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

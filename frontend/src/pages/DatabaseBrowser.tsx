import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Database, Table, Columns, RefreshCw, ChevronLeft, ChevronRight, Plus, Trash2, Pencil, Save, X, Loader2, Download, FileText, FileCode, Upload, ChevronDown } from 'lucide-react';
import Swal from 'sweetalert2';
import { dbApi, tableApi } from '../services/api';
import type { TableInfo, TableDataResponse, ColumnInfo } from '../types';

interface EditingCell {
    rowPk: string | number;
    colName: string;
}

export const DatabaseBrowser: React.FC = () => {
    const navigate = useNavigate();
    const [databases, setDatabases] = useState<string[]>([]);
    const [expandedDb, setExpandedDb] = useState<string | null>(null);
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
    const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
    const [editingValue, setEditingValue] = useState<string>('');
    const [isAddingRow, setIsAddingRow] = useState(false);
    const [newRowData, setNewRowData] = useState<Record<string, any>>({});
    const [showExportMenu, setShowExportMenu] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [importResult, setImportResult] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const exportMenuRef = useRef<HTMLDivElement>(null);
    const hasFetchedDatabases = useRef(false);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
                setShowExportMenu(false);
            }
        };

        if (showExportMenu) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showExportMenu]);

    useEffect(() => {
        if (hasFetchedDatabases.current) return;
        hasFetchedDatabases.current = true;
        fetchDatabases();
    }, []);

    const fetchDatabases = async () => {
        setLoading(true);
        const result = await dbApi.getDatabases();
        if (result.success && result.databases) {
            setDatabases(result.databases);
        } else {
            setError(result.error || 'Failed to load databases');
        }
        setLoading(false);
    };

    useEffect(() => {
        if (selectedTable) {
            loadTableData(selectedTable, page);
            loadTableStructure(selectedTable);
        }
    }, [selectedTable, page]);

    const handleDatabaseSelect = async (dbName: string) => {
        if (expandedDb === dbName) {
            setExpandedDb(null); // Collapse
            return;
        }

        setLoading(true);
        setError(null);
        // Switch context
        const connectResult = await dbApi.switchDatabase(dbName);
        if (connectResult.success) {
            setExpandedDb(dbName);
            // Fetch tables for this db
            const result = await tableApi.getTables();
            if (result.success && result.tables) {
                setTables(result.tables);
                setSelectedTable(null); // Reset table selection
            } else {
                setError(result.error || 'Failed to load tables');
            }
        } else {
            setError(connectResult.message || 'Failed to switch database');
        }
        setLoading(false);
    };

    const handleTableSelect = (tableName: string) => {
        setSelectedTable(tableName);
        setPage(1);
        setEditingCell(null);
        setIsAddingRow(false);
    };

    const loadTables = async () => {
        if (!expandedDb) return;
        setLoading(true);
        const result = await tableApi.getTables();
        if (result.success && result.tables) {
            setTables(result.tables);
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

    const getPrimaryKeyValue = (row: Record<string, any>): string | number => {
        if (primaryKeys.length > 0) {
            return row[primaryKeys[0]];
        }
        return row['id'] || row[Object.keys(row)[0]];
    };

    const getPrimaryKeyColumn = (): string => {
        if (primaryKeys.length > 0) {
            return primaryKeys[0];
        }
        return 'id';
    };

    const handleCellClick = (row: Record<string, any>, col: string) => {
        const pkValue = getPrimaryKeyValue(row);
        // Don't restart edit if already editing this cell
        if (editingCell?.rowPk === pkValue && editingCell?.colName === col) return;

        setEditingCell({ rowPk: pkValue, colName: col });
        setEditingValue(row[col] === null ? '' : String(row[col]));
    };

    const saveCellEdit = async () => {
        if (!selectedTable || !editingCell) return;

        // Find original row to get old value
        const originalRow = tableData?.rows?.find(r => getPrimaryKeyValue(r) === editingCell.rowPk);
        const originalValue = originalRow ? originalRow[editingCell.colName] : 'Unknown';

        // Convert to string for comparison and display, handling null/undefined
        const originalStr = originalValue === null ? 'NULL' : String(originalValue);

        // UX: If value hasn't changed, just exit without annoyance
        if (originalStr === editingValue || (originalValue === null && editingValue === '')) {
            setEditingCell(null);
            setEditingValue('');
            return;
        }

        const { isConfirmed } = await Swal.fire({
            title: 'Confirm Update',
            html: `
                <div class="text-left text-sm">
                    <p class="mb-2">Updating column <b>${editingCell.colName}</b>:</p>
                    <div class="grid grid-cols-[80px_1fr] gap-2 items-center">
                        <span class="text-slate-500">Old Value:</span>
                        <code class="bg-red-50 text-red-700 px-2 py-1 rounded border border-red-200 block truncate">${originalStr}</code>
                        
                        <span class="text-slate-500">New Value:</span>
                        <code class="bg-green-50 text-green-700 px-2 py-1 rounded border border-green-200 block truncate">${editingValue}</code>
                    </div>
                </div>
            `,
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#d33',
            confirmButtonText: 'Yes, update it!'
        });

        if (isConfirmed) {
            const data = { [editingCell.colName]: editingValue };
            const result = await tableApi.updateRow(selectedTable, editingCell.rowPk, getPrimaryKeyColumn(), data);

            if (result.success) {
                await loadTableData(selectedTable, page);
                setEditingCell(null);
                setEditingValue('');
                Swal.fire({
                    title: 'Updated!',
                    text: 'The cell has been updated.',
                    icon: 'success',
                    timer: 1500
                });
            } else {
                setError(result.error || 'Update failed');
            }
        } else {
            // Cancelled, reset edit state
            setEditingCell(null);
            setEditingValue('');
        }
    };

    const handleCellBlur = () => {
        // We use a small timeout to allow other events (like formatting buttons if we had them) to fire
        // But mainly to detach execution from the immediate blur event
        // Note: In some UX, clicking away might NOT want to save. 
        // But requirement says "when user clicks outside... ask for confirmation"
        saveCellEdit();
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault(); // Prevent newline if textarea (though we use input)
            saveCellEdit();
        } else if (e.key === 'Escape') {
            setEditingCell(null);
            setEditingValue('');
        }
    };

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
            {/* Sidebar - Database & Table Tree */}
            <div className="w-64 bg-white border-r border-slate-200 flex flex-col">
                <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Database className="text-primary-600" size={20} />
                        <h1 className="font-bold text-slate-800">QueryPop</h1>
                    </div>
                    <button onClick={fetchDatabases} className="p-1 hover:bg-slate-100 rounded">
                        <RefreshCw size={16} className="text-slate-500" />
                    </button>
                </div>

                <div className="p-3 border-b border-slate-100">
                    <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Databases</h2>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {databases.length === 0 && !loading && (
                        <div className="p-4 text-sm text-slate-400 text-center">No databases found</div>
                    )}
                    {databases.map(db => (
                        <div key={db}>
                            <button
                                onClick={() => handleDatabaseSelect(db)}
                                className={`w-full text-left px-4 py-2 flex items-center gap-2 hover:bg-slate-50 transition-colors ${expandedDb === db ? 'font-semibold text-slate-900 bg-slate-50' : 'text-slate-700'
                                    }`}
                            >
                                <Database size={14} className={expandedDb === db ? 'text-primary-600' : 'text-slate-400'} />
                                <span className="truncate text-sm">{db}</span>
                                {expandedDb === db ? (
                                    <ChevronDown size={14} className="ml-auto text-slate-400" />
                                ) : (
                                    <ChevronRight size={14} className="ml-auto text-slate-400" />
                                )}
                            </button>

                            {/* Tables list under active DB */}
                            {expandedDb === db && (
                                <div className="pl-4 border-l-2 border-slate-100 ml-4 mb-2">
                                    {loading && tables.length === 0 ? (
                                        <div className="px-4 py-2 text-xs text-slate-400 flex items-center gap-2">
                                            <Loader2 size={12} className="animate-spin" /> Loading...
                                        </div>
                                    ) : tables.length === 0 ? (
                                        <div className="px-4 py-2 text-xs text-slate-400">No tables found</div>
                                    ) : (
                                        tables.map(table => (
                                            <button
                                                key={table.name}
                                                onClick={() => handleTableSelect(table.name)}
                                                className={`w-full text-left px-3 py-1.5 flex items-center gap-2 hover:text-primary-700 transition-colors ${selectedTable === table.name ? 'text-primary-600 font-medium bg-primary-50 rounded' : 'text-slate-600'
                                                    }`}
                                            >
                                                <Table size={13} className="shrink-0" />
                                                <span className="truncate text-xs">{table.name}</span>
                                                <span className="ml-auto text-[10px] text-slate-400">{table.column_count}</span>
                                            </button>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>
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
                        <div className="relative" ref={exportMenuRef}>
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
                                        <Upload size={14} />
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
                                {isImporting ? <Loader2 size={16} className="animate-spin" /> : <FileCode size={16} />}
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

                                            return (
                                                <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                                                    <td className="px-4 py-2">
                                                        <div className="flex gap-1">
                                                            <button onClick={() => deleteRow(row)} className="p-1 text-red-600 hover:bg-red-100 rounded" title="Delete Row">
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                    {tableData.columns!.map(col => {
                                                        const isEditing = editingCell?.rowPk === pkValue && editingCell?.colName === col;
                                                        const isPk = primaryKeys.includes(col);

                                                        return (
                                                            <td
                                                                key={col}
                                                                className={`px-4 py-2 text-slate-700 font-mono text-xs ${!isPk ? 'cursor-pointer hover:bg-blue-50' : ''}`}
                                                                onClick={() => !isPk && !isEditing && handleCellClick(row, col)}
                                                                title={!isPk ? "Click to edit" : "Primary Key (Cannot Edit)"}
                                                            >
                                                                {isEditing ? (
                                                                    <input
                                                                        type="text"
                                                                        value={editingValue}
                                                                        onChange={(e) => setEditingValue(e.target.value)}
                                                                        onBlur={handleCellBlur}
                                                                        onKeyDown={handleKeyDown}
                                                                        autoFocus
                                                                        className="w-full px-2 py-1 border border-blue-500 rounded text-sm outline-none shadow-sm"
                                                                    />
                                                                ) : (
                                                                    <span className="block truncate max-w-xs">
                                                                        {row[col] === null ? <span className="text-slate-400 italic">NULL</span> : String(row[col])}
                                                                    </span>
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

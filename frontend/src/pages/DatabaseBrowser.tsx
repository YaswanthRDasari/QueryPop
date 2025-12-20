import React, { useState, useEffect, useRef } from 'react';
import { Database, Table, Columns, RefreshCw, ChevronLeft, ChevronRight, Plus, Trash2, Save, X, Loader2, ChevronDown, Search, Play, FileCode, Upload, Layout, Download } from 'lucide-react';
import Swal from 'sweetalert2';
import { dbApi, tableApi } from '../services/api';
import type { TableInfo, TableDataResponse, ColumnInfo } from '../types';

// Tab Components
import { StructureTab } from '../components/StructureTab';
import { SQLTab } from '../components/SQLTab';
import { SearchTab } from '../components/SearchTab';
import { QueryTab } from '../components/QueryTab';
import { ExportTab } from '../components/ExportTab';
import { ImportTab } from '../components/ImportTab';

type TabId = 'browse' | 'structure' | 'sql' | 'search' | 'query' | 'export' | 'import';

interface EditingCell {
    rowPk: string | number;
    colName: string;
}

export const DatabaseBrowser: React.FC = () => {

    // Core State
    const [databases, setDatabases] = useState<string[]>([]);
    const [expandedDb, setExpandedDb] = useState<string | null>(null);
    const [tables, setTables] = useState<TableInfo[]>([]);
    const [selectedTable, setSelectedTable] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<TabId>('browse');

    // Browse Tab State
    const [tableData, setTableData] = useState<TableDataResponse | null>(null);
    const [tableStructure, setTableStructure] = useState<ColumnInfo[]>([]);
    const [primaryKeys, setPrimaryKeys] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [perPage] = useState(25);
    const [filters, setFilters] = useState<Record<string, string>>({});

    // Editing state
    const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
    const [editingValue, setEditingValue] = useState<string>('');
    const [isAddingRow, setIsAddingRow] = useState(false);
    const [newRowData, setNewRowData] = useState<Record<string, any>>({});

    // Check initialization
    const hasFetchedDatabases = useRef(false);

    useEffect(() => {
        if (hasFetchedDatabases.current) return;
        hasFetchedDatabases.current = true;
        fetchDatabases();
    }, []);

    // When table selected, reset to browse and load data
    useEffect(() => {
        if (selectedTable) {
            setPage(1);
            setFilters({});
            setActiveTab('browse');
            loadTableData(selectedTable, 1, {});
            loadTableStructure(selectedTable);
        } else {
            // If no table selected, show SQL or Query tab roughly? Or just placeholder.
            // But we keep Browse as default which shows "Select a table".
        }
    }, [selectedTable]);

    // Reload data when page or filter changes (only if in browse tab & table selected)
    // Actually, `loadTableData` is called manually in most cases, but we can have effect for page/filter
    useEffect(() => {
        if (selectedTable && activeTab === 'browse') {
            loadTableData(selectedTable, page, filters);
        }
    }, [page, filters]); // Note: don't include selectedTable or activeTab to avoid double-fetch on select

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

    const handleDatabaseSelect = async (dbName: string) => {
        if (expandedDb === dbName) {
            setExpandedDb(null);
            return;
        }

        // Eagerly update UI state
        setLoading(true);
        setError(null);
        setExpandedDb(dbName);
        setTables([]); // Clear previous tables immediatey to show loader

        const connectResult = await dbApi.switchDatabase(dbName);
        if (connectResult.success) {
            // Database switched, now fetch tables
            const result = await tableApi.getTables();
            if (result.success && result.tables) {
                setTables(result.tables);
                setSelectedTable(null);
                setTableData(null);
            } else {
                setError(result.error || 'Failed to load tables');
            }
        } else {
            // Revert expansion if connection failed
            setExpandedDb(null);
            setError(connectResult.message || 'Failed to switch database');
        }
        setLoading(false);
    };

    const loadTableData = async (tableName: string, pageNum: number, currentFilters: Record<string, string>) => {
        setLoading(true);
        const result = await tableApi.getTableData(tableName, pageNum, perPage, undefined, 'asc', currentFilters);
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

    // --- Tab Switching Logic ---
    const handleTabChange = (tab: TabId) => {
        setActiveTab(tab);
        if (tab === 'browse' && selectedTable) {
            // Just ensure data is refreshed if we came back? 
            // Optional, but might be good if other tabs changed data (SQL/Import).
            // For now, let's just rely on state unless we explicitly refresh.
        }
    };

    const handleSearchRequest = (newFilters: Record<string, string>) => {
        setFilters(newFilters);
        setPage(1);
        setActiveTab('browse');
    };

    const handleImportSuccess = () => {
        // Reload table list and data
        fetchDatabases(); // Might need full refresh if tables added
        if (expandedDb) {
            // ideally just refresh tables for current db
            // But simple catch-all:
            if (selectedTable) {
                loadTableData(selectedTable, page, filters);
            }
        }
        setActiveTab('browse');
    };

    // --- Helper Functions for Browse Tab ---
    const getPrimaryKeyValue = (row: Record<string, any>): string | number => {
        if (primaryKeys.length > 0) return row[primaryKeys[0]];
        return row['id'] || row[Object.keys(row)[0]];
    };

    const getPrimaryKeyColumn = (): string => {
        return primaryKeys.length > 0 ? primaryKeys[0] : 'id';
    };

    const handleCellClick = (row: Record<string, any>, col: string) => {
        const pkValue = getPrimaryKeyValue(row);
        if (editingCell?.rowPk === pkValue && editingCell?.colName === col) return;
        setEditingCell({ rowPk: pkValue, colName: col });
        setEditingValue(row[col] === null ? '' : String(row[col]));
    };

    const saveCellEdit = async () => {
        if (!selectedTable || !editingCell) return;
        const originalRow = tableData?.rows?.find(r => getPrimaryKeyValue(r) === editingCell.rowPk);
        const originalValue = originalRow ? originalRow[editingCell.colName] : 'Unknown';
        const originalStr = originalValue === null ? 'NULL' : String(originalValue);

        if (originalStr === editingValue || (originalValue === null && editingValue === '')) {
            setEditingCell(null);
            setEditingValue('');
            return;
        }

        const { isConfirmed } = await Swal.fire({
            title: 'Confirm Update',
            html: `Update <b>${editingCell.colName}</b> from <code>${originalStr}</code> to <code>${editingValue}</code>?`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Update'
        });

        if (isConfirmed) {
            const data = { [editingCell.colName]: editingValue };
            const result = await tableApi.updateRow(selectedTable, editingCell.rowPk, getPrimaryKeyColumn(), data);
            if (result.success) {
                await loadTableData(selectedTable, page, filters);
                setEditingCell(null);
                setEditingValue('');
            } else {
                setError(result.error || 'Update failed');
            }
        } else {
            setEditingCell(null);
            setEditingValue('');
        }
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
            await loadTableData(selectedTable, page, filters);
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
            await loadTableData(selectedTable, page, filters);
        } else {
            setError(result.error || 'Delete failed');
        }
    };

    // --- Render Helpers ---

    return (
        <div className="flex h-screen bg-slate-100 font-sans">
            {/* Sidebar */}
            <div className="w-64 bg-white border-r border-slate-200 flex flex-col shrink-0">
                <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Database className="text-primary-600" size={20} />
                        <h1 className="font-bold text-slate-800">QueryPop</h1>
                    </div>
                    <button onClick={fetchDatabases} className="p-1 hover:bg-slate-100 rounded" title="Refresh Databases">
                        <RefreshCw size={16} className="text-slate-500" />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-2">
                    {databases.map(db => (
                        <div key={db} className="mb-1">
                            <button
                                onClick={() => handleDatabaseSelect(db)}
                                className={`w-full text-left px-3 py-2 flex items-center gap-2 rounded-lg transition-colors ${expandedDb === db ? 'bg-slate-100 text-slate-900 font-medium' : 'text-slate-600 hover:bg-slate-50'}`}
                            >
                                <Database size={14} className={expandedDb === db ? 'text-primary-600' : 'text-slate-400'} />
                                <span className="truncate text-sm flex-1">{db}</span>
                                {expandedDb === db ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </button>
                            {expandedDb === db && (
                                <div className="ml-5 mt-1 border-l-2 border-slate-100 pl-2 space-y-0.5">
                                    {loading && tables.length === 0 ? (
                                        <div className="px-3 py-2 text-xs text-slate-400 flex items-center gap-2 animate-pulse">
                                            <Loader2 size={12} className="animate-spin" />
                                            <span>Loading tables...</span>
                                        </div>
                                    ) : (
                                        <>
                                            {tables.map(table => (
                                                <button
                                                    key={table.name}
                                                    onClick={() => setSelectedTable(table.name)}
                                                    className={`w-full text-left px-3 py-1.5 flex items-center gap-2 rounded text-xs transition-colors ${selectedTable === table.name ? 'text-primary-700 bg-primary-50 font-medium' : 'text-slate-500 hover:text-primary-600'}`}
                                                >
                                                    <Table size={13} />
                                                    <span className="truncate">{table.name}</span>
                                                </button>
                                            ))}
                                            {tables.length === 0 && !loading && (
                                                <div className="px-3 py-1 text-xs text-slate-400">No tables</div>
                                            )}
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Header with Tabs */}
                {selectedTable ? (
                    <div className="bg-white border-b border-slate-200 px-6 pt-4 pb-0">
                        <div className="flex items-center gap-3 mb-4">
                            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                <span className="text-slate-400 font-normal">{expandedDb} /</span>
                                {selectedTable}
                            </h2>
                            {tableData?.pagination && (
                                <span className="text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-500">
                                    {tableData.pagination.total_count} rows
                                </span>
                            )}
                            {Object.keys(filters).length > 0 && (
                                <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded border border-yellow-200">
                                    Filtered
                                </span>
                            )}
                        </div>

                        {/* Tabs */}
                        <div className="flex gap-6 border-b border-transparent">
                            {[
                                { id: 'browse', label: 'Browse', icon: <Columns size={16} /> },
                                { id: 'structure', label: 'Structure', icon: <Layout size={16} /> },
                                { id: 'sql', label: 'SQL', icon: <FileCode size={16} /> },
                                { id: 'search', label: 'Search', icon: <Search size={16} /> },
                                { id: 'query', label: 'AI Query', icon: <Play size={16} /> }, // Using Play as sparkle isn't default in lucide v1 maybe
                                { id: 'export', label: 'Export', icon: <Download size={16} /> },
                                { id: 'import', label: 'Import', icon: <Upload size={16} /> },
                            ].map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => handleTabChange(tab.id as TabId)}
                                    className={`pb-3 flex items-center gap-2 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.id ? 'border-primary-600 text-primary-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}
                                >
                                    {tab.icon}
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="bg-white border-b border-slate-200 px-6 py-4">
                        <h2 className="text-lg font-medium text-slate-500">Select a table to start</h2>
                    </div>
                )}

                {/* Error Banner */}
                {error && (
                    <div className="m-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex justify-between items-center shrink-0">
                        <span>{error}</span>
                        <button onClick={() => setError(null)}><X size={16} /></button>
                    </div>
                )}

                {/* Content Area */}
                <div className="flex-1 overflow-auto bg-slate-50/50">
                    {!selectedTable ? (
                        <div className="flex items-center justify-center h-full text-slate-400">
                            <div className="text-center">
                                <Database size={48} className="mx-auto mb-4 opacity-50" />
                                <p>Select a database and table from the sidebar</p>
                            </div>
                        </div>
                    ) : (
                        <>
                            {activeTab === 'browse' && (
                                <div className="p-6 h-full flex flex-col">
                                    {/* Action Bar */}
                                    <div className="flex justify-end mb-4 gap-2">
                                        {Object.keys(filters).length > 0 && (
                                            <button
                                                onClick={() => { setFilters({}); setPage(1); }}
                                                className="bg-yellow-50 text-yellow-700 hover:bg-yellow-100 px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors border border-yellow-200"
                                            >
                                                <X size={16} /> Clear Filters
                                            </button>
                                        )}
                                        <button
                                            onClick={() => setIsAddingRow(true)}
                                            className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors shadow-sm"
                                        >
                                            <Plus size={16} /> Insert Row
                                        </button>
                                    </div>

                                    {loading ? (
                                        <div className="flex-1 flex items-center justify-center">
                                            <Loader2 className="animate-spin text-primary-600" size={32} />
                                        </div>
                                    ) : (
                                        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden flex-1 flex flex-col">
                                            <div className="overflow-auto flex-1">
                                                <table className="w-full text-sm text-left">
                                                    <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 shadow-sm z-10">
                                                        <tr>
                                                            <th className="px-4 py-3 font-semibold text-slate-500 uppercase w-20 bg-slate-50">Actions</th>
                                                            {tableData?.columns?.map(col => (
                                                                <th key={col} className="px-4 py-3 font-semibold text-slate-500 uppercase whitespace-nowrap bg-slate-50">
                                                                    {col}
                                                                    {primaryKeys.includes(col) && <span className="ml-1 text-primary-500">🔑</span>}
                                                                </th>
                                                            ))}
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {isAddingRow && (
                                                            <tr className="bg-green-50 border-b border-green-200">
                                                                <td className="px-4 py-2">
                                                                    <div className="flex gap-1">
                                                                        <button onClick={saveNewRow} className="p-1 text-green-600 hover:bg-green-100 rounded"><Save size={14} /></button>
                                                                        <button onClick={() => setIsAddingRow(false)} className="p-1 text-slate-500 hover:bg-slate-100 rounded"><X size={14} /></button>
                                                                    </div>
                                                                </td>
                                                                {tableData?.columns?.map(col => (
                                                                    <td key={col} className="px-4 py-2">
                                                                        <input
                                                                            value={newRowData[col] || ''}
                                                                            onChange={e => setNewRowData({ ...newRowData, [col]: e.target.value })}
                                                                            className="w-full px-2 py-1 border border-green-300 rounded text-sm bg-white"
                                                                            placeholder={tableStructure.find(c => c.name === col)?.autoincrement ? '(auto)' : ''}
                                                                            disabled={tableStructure.find(c => c.name === col)?.autoincrement}
                                                                        />
                                                                    </td>
                                                                ))}
                                                            </tr>
                                                        )}
                                                        {tableData?.rows?.map((row, i) => (
                                                            <tr key={i} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors group">
                                                                <td className="px-4 py-2 relative">
                                                                    <button onClick={() => deleteRow(row)} className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors opacity-0 group-hover:opacity-100">
                                                                        <Trash2 size={14} />
                                                                    </button>
                                                                </td>
                                                                {tableData.columns.map(col => {
                                                                    const isEditing = editingCell?.rowPk === getPrimaryKeyValue(row) && editingCell?.colName === col;
                                                                    const val = row[col];
                                                                    return (
                                                                        <td
                                                                            key={col}
                                                                            onClick={() => !primaryKeys.includes(col) && handleCellClick(row, col)}
                                                                            className={`px-4 py-2 font-mono text-slate-700 cursor-pointer ${isEditing ? 'p-0' : ''}`}
                                                                        >
                                                                            {isEditing ? (
                                                                                <input
                                                                                    autoFocus
                                                                                    value={editingValue}
                                                                                    onChange={e => setEditingValue(e.target.value)}
                                                                                    onBlur={saveCellEdit}
                                                                                    onKeyDown={e => { if (e.key === 'Enter') saveCellEdit(); if (e.key === 'Escape') { setEditingCell(null); setEditingValue(''); } }}
                                                                                    className="w-full h-full px-2 py-1 border-2 border-primary-500 outline-none"
                                                                                />
                                                                            ) : (
                                                                                <span className={val === null ? "text-slate-400 italic" : ""}>{val === null ? "NULL" : String(val)}</span>
                                                                            )}
                                                                        </td>
                                                                    );
                                                                })}
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                            {/* Pagination */}
                                            <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm text-slate-500 mr-2">
                                                        Page {tableData?.pagination?.page} of {tableData?.pagination?.total_pages}
                                                    </span>
                                                </div>

                                                <div className="flex items-center gap-1">
                                                    <button
                                                        onClick={() => setPage(1)}
                                                        disabled={page === 1}
                                                        className="p-1 border rounded hover:bg-white disabled:opacity-50 text-slate-500"
                                                        title="First Page"
                                                    >
                                                        <span style={{ fontSize: '10px' }}>&laquo;</span>
                                                    </button>
                                                    <button
                                                        onClick={() => setPage(p => Math.max(1, p - 1))}
                                                        disabled={page === 1}
                                                        className="p-1 border rounded hover:bg-white disabled:opacity-50 text-slate-500"
                                                        title="Previous Page"
                                                    >
                                                        <ChevronLeft size={16} />
                                                    </button>

                                                    {/* Numbered Buttons */}
                                                    <div className="flex items-center gap-1 mx-2">
                                                        {Array.from({ length: Math.min(5, tableData?.pagination?.total_pages || 1) }, (_, i) => {
                                                            const totalPages = tableData?.pagination?.total_pages || 1;
                                                            let p = i + 1;
                                                            if (totalPages > 5) {
                                                                if (page <= 3) { p = i + 1; }
                                                                else if (page >= totalPages - 2) { p = totalPages - 4 + i; }
                                                                else { p = page - 2 + i; }
                                                            }
                                                            return (
                                                                <button
                                                                    key={p}
                                                                    onClick={() => setPage(p)}
                                                                    disabled={p === page}
                                                                    className={`w-8 h-8 flex items-center justify-center rounded border text-sm transition-colors ${p === page
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
                                                        onClick={() => setPage(p => Math.min(tableData?.pagination?.total_pages || 1, p + 1))}
                                                        disabled={page === (tableData?.pagination?.total_pages || 1)}
                                                        className="p-1 border rounded hover:bg-white disabled:opacity-50 text-slate-500"
                                                        title="Next Page"
                                                    >
                                                        <ChevronRight size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => setPage(tableData?.pagination?.total_pages || 1)}
                                                        disabled={page === (tableData?.pagination?.total_pages || 1)}
                                                        className="p-1 border rounded hover:bg-white disabled:opacity-50 text-slate-500"
                                                        title="Last Page"
                                                    >
                                                        <span style={{ fontSize: '10px' }}>&raquo;</span>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeTab === 'structure' && <StructureTab tableName={selectedTable} />}
                            {activeTab === 'sql' && <SQLTab tableName={selectedTable} />}
                            {activeTab === 'search' && <SearchTab tableName={selectedTable} onSearch={handleSearchRequest} />}
                            {activeTab === 'query' && <QueryTab tableName={selectedTable} />}
                            {activeTab === 'export' && <ExportTab tableName={selectedTable} />}
                            {activeTab === 'import' && <ImportTab onImportSuccess={handleImportSuccess} />}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

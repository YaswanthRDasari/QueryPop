import React, { useState, useEffect, useRef } from 'react';
import { Database, Table, Columns, RefreshCw, ChevronLeft, ChevronRight, Plus, Trash2, Save, X, Loader2, ChevronDown, Search, Play, FileCode, Upload, Layout, Download, Pencil, Server, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import Swal from 'sweetalert2';
import { message } from 'antd';
import { dbApi, tableApi } from '../services/api';
import type { TableInfo, TableDataResponse, ColumnInfo, ConnectionInfo } from '../types';

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

const SQL_KEYWORDS = ['SELECT', 'FROM', 'WHERE', 'LIMIT', 'ORDER', 'BY', 'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 'ON', 'GROUP', 'HAVING', 'AND', 'OR', 'NOT', 'NULL', 'IS', 'LIKE', 'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'AS', 'DISTINCT'];

const highlightSql = (sql: string) => {
    if (!sql) return null;

    // Split by word boundaries but keep delimiters to reconstruct
    const parts = sql.split(/(\b\w+\b)/g);

    return parts.map((part, i) => {
        if (SQL_KEYWORDS.includes(part.toUpperCase())) {
            return <span key={i} className="text-blue-600 font-bold">{part}</span>;
        } else if (/^['"`]/.test(part)) {
            // Basic string/quote detection (simplified as split might break strings)
            // Actually, the simple split above isn't great for strings with spaces.
            // Let's use a simpler approach: strict word matching? 
            // RegEx replacement approach is better for react rendering?
            return part;
        }
        return part;
    });
};

// Improved highlighter using simple parsing
const HighlightedSQL = ({ code }: { code: string }) => {
    const tokens = [];
    const regex = new RegExp(`\\b(${SQL_KEYWORDS.join('|')})\\b`, 'gi');
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(code)) !== null) {
        if (match.index > lastIndex) {
            tokens.push(code.slice(lastIndex, match.index));
        }
        tokens.push(<span key={match.index} className="text-blue-600 font-bold">{match[0]}</span>);
        lastIndex = regex.lastIndex;
    }
    if (lastIndex < code.length) {
        tokens.push(code.slice(lastIndex));
    }
    return <>{tokens}</>;
};

export const DatabaseBrowser: React.FC = () => {

    // Core State
    const [databases, setDatabases] = useState<string[]>([]);
    const [expandedDb, setExpandedDb] = useState<string | null>(null);
    const [tables, setTables] = useState<TableInfo[]>([]);
    const [selectedTable, setSelectedTable] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<TabId>('browse');
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [sidebarWidth, setSidebarWidth] = useState(288); // Default w-72 (18rem * 16px)
    const [isResizing, setIsResizing] = useState(false);
    const [sidebarSearch, setSidebarSearch] = useState('');
    const [isSearchOpen, setIsSearchOpen] = useState(false);

    // Connection Info State
    const [connectionInfo, setConnectionInfo] = useState<ConnectionInfo | null>(null);

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

    // Row Editing State
    const [editingRowPk, setEditingRowPk] = useState<string | number | null>(null);
    const [editingRowData, setEditingRowData] = useState<Record<string, any>>({});

    // Autocomplete State
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [suggestionIndex, setSuggestionIndex] = useState(0);

    // SQL Tab State
    const [sqlTabInitialQuery, setSqlTabInitialQuery] = useState<string | undefined>(undefined);

    // Displayed SQL in Browse Tab (Controlled)
    const [displayedSql, setDisplayedSql] = useState<string>('');

    // Check initialization
    const hasFetchedDatabases = useRef(false);
    const isSaving = useRef(false);
    const backdropRef = useRef<HTMLPreElement>(null);

    useEffect(() => {
        if (hasFetchedDatabases.current) return;
        hasFetchedDatabases.current = true;
        fetchDatabases();
        fetchConnectionInfo();
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

    // Sync displayed SQL with fetched data
    useEffect(() => {
        if (tableData?.sql_query) {
            setDisplayedSql(tableData.sql_query);
        }
    }, [tableData?.sql_query]);

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

    const fetchConnectionInfo = async () => {
        const result = await dbApi.getConnectionInfo();
        if (result.success && result.info) {
            setConnectionInfo(result.info);
        }
    };

    const loadTableData = async (tableName: string, pageNum: number, currentFilters: Record<string, string>) => {
        setLoading(true);
        setError(null);
        try {
            const tableDataRes = await tableApi.getTableData(tableName, pageNum, perPage, undefined, 'asc', currentFilters);

            if (tableDataRes.success) {
                setTableData(tableDataRes);
            } else {
                setError(tableDataRes.error || 'Failed to load table data');
            }
        } catch (err) {
            setError('Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    const loadTableStructure = async (tableName: string) => {
        const structureRes = await tableApi.getTableStructure(tableName);
        if (structureRes.success && structureRes.columns) {
            setTableStructure(structureRes.columns);
            setPrimaryKeys(structureRes.primary_keys || []);
        }
    };

    // ... rest of the component ...


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
        if (!selectedTable || !editingCell || isSaving.current) return;

        isSaving.current = true;

        try {
            const originalRow = tableData?.rows?.find(r => getPrimaryKeyValue(r) === editingCell.rowPk);
            const originalValue = originalRow ? originalRow[editingCell.colName] : null;

            // Normalize values for comparison
            const strOriginal = originalValue === null ? 'NULL' : String(originalValue);
            const strNew = editingValue === '' ? 'NULL' : editingValue;

            // If no change, just exit edit mode
            if (strOriginal === strNew || (originalValue === null && editingValue === '')) {
                setEditingCell(null);
                setEditingValue('');
                return;
            }

            // Perform update directly without confirmation
            const data = { [editingCell.colName]: editingValue };
            const apiResult = await tableApi.updateRow(selectedTable, editingCell.rowPk, getPrimaryKeyColumn(), data);

            if (apiResult.success) {
                await loadTableData(selectedTable, page, filters);
                setEditingCell(null);
                setEditingValue('');
                message.success('Cell value has been updated.');
            } else {
                setError(apiResult.error || 'Update failed');
            }
        } catch (err) {
            console.error('Failed to save cell edit:', err);
            setError('An unexpected error occurred while saving');
        } finally {
            isSaving.current = false;
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

        const pkValue = getPrimaryKeyValue(row);

        const result = await Swal.fire({
            title: 'Delete Row?',
            text: `Are you sure you want to delete row with ID ${pkValue}?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Yes, delete it!'
        });

        if (!result.isConfirmed) return;

        const apiResult = await tableApi.deleteRow(selectedTable, pkValue, getPrimaryKeyColumn());
        if (apiResult.success) {
            Swal.fire('Deleted!', 'The row has been deleted.', 'success');
            await loadTableData(selectedTable, page, filters);
        } else {
            setError(apiResult.error || 'Delete failed');
            Swal.fire('Error', apiResult.error || 'Delete failed', 'error');
        }
    };

    // --- Row Editing Handlers ---
    const handleRowEditClick = (row: Record<string, any>) => {
        setEditingRowPk(getPrimaryKeyValue(row));
        // Clone row data for editing, handling nulls
        const rowData: Record<string, any> = {};
        Object.keys(row).forEach(key => {
            rowData[key] = row[key] === null ? '' : row[key];
        });
        setEditingRowData(rowData);
        // Clear single cell edit if active because row edit takes precedence
        setEditingCell(null);
    };

    const cancelRowEdit = () => {
        setEditingRowPk(null);
        setEditingRowData({});
    };

    const saveRowEdit = async () => {
        if (!selectedTable || editingRowPk === null) return;

        // Find original row to detect changes
        const originalRow = tableData?.rows?.find(r => getPrimaryKeyValue(r) === editingRowPk);
        if (!originalRow) return;

        const changes: string[] = [];
        const changedData: Record<string, any> = {};

        // Identify changes
        Object.keys(editingRowData).forEach(key => {
            const originalVal = originalRow[key];
            const newVal = editingRowData[key];

            // Loose equality check or string comparison to handle slight type diffs
            const strOriginal = originalVal === null ? 'NULL' : String(originalVal);
            const strNew = newVal === '' ? 'NULL' : String(newVal); // Assuming empty string in input might mean NULL or empty depending on context, keeping as is for now.

            // Only track actual changes. 
            // Note: editingRowData init forces null -> ''. If original is null and new is '', treat as no change?
            // User might want to set empty string. Let's assume strict diff for now but be careful with nulls.
            if (strOriginal !== strNew) {
                changes.push(`<b>${key}</b>: ${strOriginal} &rarr; <b>${strNew}</b>`);
                changedData[key] = newVal;
            }
        });

        if (changes.length === 0) {
            setEditingRowPk(null);
            setEditingRowData({});
            return;
        }

        const result = await Swal.fire({
            title: 'Confirm Changes',
            html: `<div class="text-left text-sm">${changes.join('<br>')}</div>`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Save Changes',
            confirmButtonColor: '#3085d6',
        });

        if (!result.isConfirmed) return;

        const apiResult = await tableApi.updateRow(selectedTable, editingRowPk, getPrimaryKeyColumn(), editingRowData);

        if (apiResult.success) {
            await loadTableData(selectedTable, page, filters);
            setEditingRowPk(null);
            setEditingRowData({});
            Swal.fire('Saved!', 'Your changes has been updated.', 'success');
        } else {
            setError(apiResult.error || 'Update failed');
            Swal.fire('Error', apiResult.error || 'Update failed', 'error');
        }
    };

    // --- Sidebar Resize Logic ---
    const startResizing = React.useCallback(() => {
        setIsResizing(true);
    }, []);

    const stopResizing = React.useCallback(() => {
        setIsResizing(false);
    }, []);

    const resize = React.useCallback((mouseMoveEvent: MouseEvent) => {
        if (isResizing) {
            const newWidth = mouseMoveEvent.clientX;
            if (newWidth > 150 && newWidth < 600) { // Min and Max width constraints
                setSidebarWidth(newWidth);
            }
        }
    }, [isResizing]);

    useEffect(() => {
        window.addEventListener("mousemove", resize);
        window.addEventListener("mouseup", stopResizing);
        return () => {
            window.removeEventListener("mousemove", resize);
            window.removeEventListener("mouseup", stopResizing);
        };
    }, [resize, stopResizing]);

    // --- Render Helpers ---

    return (
        <div className="flex h-screen bg-slate-50 font-sans text-slate-900">
            {/* Sidebar */}
            {/* Sidebar */}
            {/* Sidebar */}
            {/* Sidebar */}
            <div
                style={{ width: sidebarOpen ? sidebarWidth : 0 }}
                className={`${sidebarOpen ? 'border-r' : 'border-none'} bg-slate-900 text-slate-300 flex flex-col shadow-xl shrink-0 transition-all duration-75 ease-out relative overflow-hidden`}
            >
                {/* Resize Handle */}
                <div
                    className="absolute right-0 top-0 w-1 h-full cursor-col-resize hover:bg-primary-500 hover:w-1.5 transition-all z-50 group translate-x-1/2"
                    onMouseDown={startResizing}
                >
                    <div className={`w-0.5 h-full mx-auto bg-transparent group-hover:bg-primary-400 transition-colors ${isResizing ? 'bg-primary-500' : ''}`} />
                </div>

                <div className="p-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between h-[65px]">
                    {isSearchOpen ? (
                        <div className="flex-1 flex items-center gap-2 mr-2 animate-in fade-in zoom-in duration-200">
                            <div className="relative flex-1">
                                <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                                <input
                                    autoFocus
                                    type="text"
                                    value={sidebarSearch}
                                    onChange={(e) => setSidebarSearch(e.target.value)}
                                    placeholder="Filter..."
                                    className="w-full bg-slate-800 text-slate-200 text-xs rounded pl-8 pr-7 py-1.5 border border-slate-700 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none placeholder:text-slate-500"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Escape') {
                                            setIsSearchOpen(false);
                                            setSidebarSearch('');
                                        }
                                    }}
                                />
                                <button
                                    onClick={() => {
                                        setSidebarSearch('');
                                        setIsSearchOpen(false);
                                    }}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                                >
                                    <X size={12} />
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 overflow-hidden whitespace-nowrap animate-in fade-in zoom-in duration-200">
                            <h1 className="text-xl font-bold text-white flex items-center gap-2 tracking-tight">
                                <Database className="text-primary-500" size={24} />
                                QueryPop
                            </h1>
                        </div>
                    )}

                    <div className="flex items-center gap-1 shrink-0">
                        {!isSearchOpen && (
                            <button
                                onClick={() => setIsSearchOpen(true)}
                                className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors"
                                title="Search Databases & Tables"
                            >
                                <Search size={16} />
                            </button>
                        )}
                        <button onClick={fetchDatabases} className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors" title="Refresh Databases">
                            <RefreshCw size={16} />
                        </button>
                        <button onClick={() => setSidebarOpen(false)} className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors" title="Collapse Sidebar">
                            <PanelLeftClose size={16} />
                        </button>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                    {databases.map(db => {
                        const isExpanded = expandedDb === db;
                        const searchTerm = sidebarSearch.toLowerCase();
                        const matchesDb = db.toLowerCase().includes(searchTerm);

                        // Filter tables if this DB is expanded
                        const filteredTables = isExpanded
                            ? tables.filter(t => t.name.toLowerCase().includes(searchTerm))
                            : [];

                        const hasMatchingTables = filteredTables.length > 0;

                        // Hide DB if it doesn't match AND (it's not expanded OR no tables match)
                        // But if search is empty, show everything (matchesDb will be true)
                        if (!matchesDb && !(isExpanded && hasMatchingTables)) {
                            return null;
                        }

                        return (
                            <div key={db} className="mb-1">
                                <button
                                    onClick={() => handleDatabaseSelect(db)}
                                    className={`w-full text-left px-3 py-2 flex items-center gap-2 rounded-lg transition-colors ${isExpanded ? 'bg-slate-800 text-white font-medium shadow-sm ring-1 ring-slate-700' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'}`}
                                >
                                    <Database size={14} className={isExpanded ? 'text-primary-400' : 'text-slate-500'} />
                                    <span className="truncate text-sm flex-1">
                                        {/* Highlight match? Optional but nice */}
                                        {db}
                                    </span>
                                    {isExpanded ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-600" />}
                                </button>
                                {isExpanded && (
                                    <div className="ml-5 mt-1 border-l border-slate-700 pl-2 space-y-0.5">
                                        {loading && tables.length === 0 ? (
                                            <div className="px-3 py-2 text-xs text-slate-500 flex items-center gap-2">
                                                <Loader2 size={12} className="animate-spin" />
                                                <span>Loading tables...</span>
                                            </div>
                                        ) : (
                                            <>
                                                {filteredTables.map(table => (
                                                    <button
                                                        key={table.name}
                                                        onClick={() => setSelectedTable(table.name)}
                                                        className={`w-full text-left px-3 py-1.5 flex items-center gap-2 rounded text-xs transition-colors ${selectedTable === table.name ? 'text-primary-300 bg-primary-500/10 font-medium' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'}`}
                                                    >
                                                        <Table size={13} className={selectedTable === table.name ? 'text-primary-400' : 'text-slate-600'} />
                                                        <span className="truncate">{table.name}</span>
                                                    </button>
                                                ))}
                                                {tables.length === 0 && !loading && (
                                                    <div className="px-3 py-1 text-xs text-slate-500">No tables</div>
                                                )}
                                                {tables.length > 0 && filteredTables.length === 0 && (
                                                    <div className="px-3 py-1 text-xs text-slate-500 italic">No matching tables</div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Header with Tabs */}
                {selectedTable ? (
                    <div className="bg-white border-b border-slate-200 px-6 pt-4 pb-0">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                {!sidebarOpen && (
                                    <button onClick={() => setSidebarOpen(true)} className="p-1.5 hover:bg-slate-100 rounded text-slate-500 mr-2" title="Expand Sidebar">
                                        <PanelLeftOpen size={20} />
                                    </button>
                                )}
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

                            {/* Connection Info in Top Bar */}
                            {connectionInfo && (
                                <div className="text-xs flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-200 text-slate-600">
                                    <div className="flex items-center gap-1.5 font-medium border-r border-slate-200 pr-2 mr-1">
                                        <span className={`w-2 h-2 rounded-full ${connectionInfo.type === 'mysql' ? 'bg-blue-500' : 'bg-orange-500'}`}></span>
                                        <span className="uppercase tracking-wider">{connectionInfo.type}</span>
                                    </div>
                                    <span className="font-mono text-slate-700">
                                        <span className="text-primary-600 font-semibold">{connectionInfo.user}</span>
                                        <span className="text-slate-400">@</span>
                                        <span>{connectionInfo.host}</span>
                                        {/* Hide port to be cleaner in top bar except on hover? or small */}
                                        <span className="text-slate-400">:</span>
                                        <span>{connectionInfo.port}</span>
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Tabs */}
                        <div className="flex gap-6 border-b border-transparent">
                            {[
                                { id: 'browse', label: 'Browse', icon: <Columns size={16} /> },
                                { id: 'structure', label: 'Structure', icon: <Layout size={16} /> },
                                { id: 'sql', label: 'SQL', icon: <FileCode size={16} /> },
                                { id: 'search', label: 'Search', icon: <Search size={16} /> },
                                { id: 'query', label: 'AI Query', icon: <Play size={16} /> },
                                { id: 'export', label: 'Export', icon: <Upload size={16} /> },
                                { id: 'import', label: 'Import', icon: <Download size={16} /> },
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
                    <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between h-[73px]">
                        <div className="flex items-center gap-3">
                            {!sidebarOpen && (
                                <button onClick={() => setSidebarOpen(true)} className="p-1.5 hover:bg-slate-100 rounded text-slate-500 mr-2" title="Expand Sidebar">
                                    <PanelLeftOpen size={20} />
                                </button>
                            )}
                            <h2 className="text-lg font-medium text-slate-500">Select a table to start</h2>
                        </div>
                        {/* Connection Info in Top Bar (Empty State) */}
                        {connectionInfo && (
                            <div className="text-xs flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-200 text-slate-600">
                                <div className="flex items-center gap-1.5 font-medium border-r border-slate-200 pr-2 mr-1">
                                    <span className={`w-2 h-2 rounded-full ${connectionInfo.type === 'mysql' ? 'bg-blue-500' : 'bg-orange-500'}`}></span>
                                    <span className="uppercase tracking-wider">{connectionInfo.type}</span>
                                </div>
                                <span className="font-mono text-slate-700">
                                    <span className="text-primary-600 font-semibold">{connectionInfo.user}</span>
                                    <span className="text-slate-400">@</span>
                                    <span>{connectionInfo.host}</span>
                                    <span className="text-slate-400">:</span>
                                    <span>{connectionInfo.port}</span>
                                </span>
                            </div>
                        )}
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
                                <div className="p-6 flex flex-col min-h-full">
                                    {/* Executed Query Display */}
                                    {(tableData?.sql_query || tableData?.rows) && (
                                        <div className="mb-4 space-y-2">
                                            {/* Stats Bar */}
                                            {tableData?.pagination ? (
                                                <div className="bg-green-50 border border-green-200 text-green-800 px-3 py-2 rounded text-xs flex items-center gap-2">
                                                    <span className="font-bold">✓</span>
                                                    <span>
                                                        Showing rows {Math.min((tableData.pagination.page - 1) * tableData.pagination.per_page + 1, tableData.pagination.total_count)} - {Math.min(tableData.pagination.page * tableData.pagination.per_page, tableData.pagination.total_count)}
                                                        ({tableData.pagination.total_count} total, Query took {tableData.execution_time ? tableData.execution_time.toFixed(4) : '0.00'} seconds.)
                                                    </span>
                                                </div>
                                            ) : (
                                                <div className="bg-green-50 border border-green-200 text-green-800 px-3 py-2 rounded text-xs flex items-center gap-2">
                                                    <span className="font-bold">✓</span>
                                                    <span>
                                                        Showing {tableData?.rows?.length || 0} rows
                                                        {tableData?.execution_time && `(Query took ${tableData.execution_time.toFixed(4)} seconds)`}
                                                    </span>
                                                </div>
                                            )}

                                            {/* SQL Editor */}
                                            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 shadow-sm relative group">
                                                <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                                    <button
                                                        onClick={() => navigator.clipboard.writeText(tableData?.sql_query || '')}
                                                        className="p-1 px-2 text-xs bg-white border border-slate-200 rounded hover:bg-slate-50 text-slate-500"
                                                    >
                                                        Copy
                                                    </button>
                                                </div>
                                                <div className="flex items-center gap-2 mb-1 text-xs text-slate-400 uppercase tracking-wider font-semibold">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                                                    SQL Query
                                                </div>

                                                <div className="relative">
                                                    {/* Backdrop for highlighting */}
                                                    <pre
                                                        ref={backdropRef}
                                                        className="absolute inset-0 pointer-events-none p-3 font-mono text-sm whitespace-pre-wrap break-words overflow-auto text-primary-700 bg-transparent z-0"
                                                        aria-hidden="true"
                                                        style={{
                                                            fontFamily: 'monospace', // Ensure font matches textarea exactly
                                                        }}
                                                    >
                                                        <HighlightedSQL code={displayedSql} />
                                                        {/* Append a generic space/char to ensure height matches if ending with newline? */}
                                                        {displayedSql.endsWith('\n') && <br />}
                                                    </pre>

                                                    <textarea
                                                        id="sql-editor-textarea"
                                                        className="relative z-10 w-full bg-transparent font-mono text-sm text-transparent caret-black outline-none resize-y min-h-[40px] border-b border-transparent focus:border-primary-200 transition-colors p-3 overflow-auto whitespace-pre-wrap"
                                                        value={displayedSql}
                                                        onScroll={(e) => {
                                                            if (backdropRef.current) {
                                                                backdropRef.current.scrollTop = e.currentTarget.scrollTop;
                                                                backdropRef.current.scrollLeft = e.currentTarget.scrollLeft;
                                                            }
                                                        }}
                                                        style={{
                                                            color: 'transparent',
                                                            background: 'transparent',
                                                            caretColor: 'black', // Restore caret visibility
                                                        }}
                                                        onChange={(e) => {
                                                            const val = e.target.value;
                                                            setDisplayedSql(val);
                                                            const selectionStart = e.target.selectionStart;

                                                            const textBeforeCursor = val.slice(0, selectionStart);
                                                            const words = textBeforeCursor.split(/[\s\(\),;]+/);
                                                            const currentWord = words[words.length - 1];

                                                            if (currentWord.length > 0) {
                                                                const candidates = [
                                                                    ...SQL_KEYWORDS,
                                                                    ...tables.map(t => t.name),
                                                                    ...tableStructure.map(c => c.name)
                                                                ];
                                                                const matches = candidates.filter(c => c.toLowerCase().startsWith(currentWord.toLowerCase())).slice(0, 5);
                                                                setSuggestions(matches);
                                                                setShowSuggestions(matches.length > 0);
                                                                setSuggestionIndex(0);
                                                            } else {
                                                                setShowSuggestions(false);
                                                            }
                                                        }}
                                                        onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                                                        onKeyDown={async (e) => {
                                                            if (showSuggestions && suggestions.length > 0) {
                                                                if (e.key === 'ArrowDown') {
                                                                    e.preventDefault();
                                                                    setSuggestionIndex(prev => (prev + 1) % suggestions.length);
                                                                    return;
                                                                }
                                                                if (e.key === 'ArrowUp') {
                                                                    e.preventDefault();
                                                                    setSuggestionIndex(prev => (prev - 1 + suggestions.length) % suggestions.length);
                                                                    return;
                                                                }
                                                                if (e.key === 'Enter' || e.key === 'Tab') {
                                                                    e.preventDefault();
                                                                    const textarea = e.currentTarget;
                                                                    const val = displayedSql;
                                                                    const selectionStart = textarea.selectionStart;
                                                                    const textBeforeCursor = val.slice(0, selectionStart);
                                                                    const words = textBeforeCursor.split(/[\s\(\),;]+/);
                                                                    const currentWord = words[words.length - 1];
                                                                    const completion = suggestions[suggestionIndex];
                                                                    const newVal = val.slice(0, selectionStart - currentWord.length) + completion + val.slice(selectionStart);
                                                                    setDisplayedSql(newVal);
                                                                    const newCursorPos = selectionStart - currentWord.length + completion.length;
                                                                    textarea.setSelectionRange(newCursorPos, newCursorPos);
                                                                    setShowSuggestions(false);
                                                                    return;
                                                                }
                                                                if (e.key === 'Escape') {
                                                                    setShowSuggestions(false);
                                                                    return;
                                                                }
                                                            }

                                                            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                                                                e.preventDefault();
                                                                const query = e.currentTarget.value;
                                                                if (!query.trim()) return;
                                                                setLoading(true);
                                                                const result = await dbApi.executeQuery(query);
                                                                setLoading(false);
                                                                if (result.success && result.rows) {
                                                                    setTableData({
                                                                        success: true,
                                                                        table_name: selectedTable || 'Result',
                                                                        columns: result.columns,
                                                                        rows: result.rows,
                                                                        sql_query: query,
                                                                        execution_time: (result.execution_time_ms || 0) / 1000,
                                                                        pagination: undefined
                                                                    });
                                                                } else {
                                                                    setError(result.error || 'Query execution failed');
                                                                }
                                                            }
                                                        }}
                                                        placeholder="Type SQL and press Ctrl+Enter to run..."
                                                    />
                                                    {showSuggestions && (
                                                        <div className="absolute left-0 bottom-full mb-1 bg-white border border-slate-200 rounded-lg shadow-lg z-20 min-w-[150px] overflow-hidden">
                                                            {suggestions.map((s, i) => (
                                                                <div
                                                                    key={s}
                                                                    className={`px-3 py-1.5 text-xs cursor-pointer flex items-center gap-2 ${i === suggestionIndex ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}
                                                                    onMouseDown={(e) => {
                                                                        e.preventDefault();
                                                                        const textarea = document.getElementById('sql-editor-textarea') as HTMLTextAreaElement;
                                                                        if (textarea) {
                                                                            const val = displayedSql;
                                                                            const selectionStart = textarea.selectionStart;
                                                                            const textBeforeCursor = val.slice(0, selectionStart);
                                                                            const words = textBeforeCursor.split(/[\s\(\),;]+/);
                                                                            const currentWord = words[words.length - 1];
                                                                            const completion = s;
                                                                            const newVal = val.slice(0, selectionStart - currentWord.length) + completion + val.slice(selectionStart);
                                                                            setDisplayedSql(newVal);
                                                                            const newCursorPos = selectionStart - currentWord.length + completion.length;
                                                                            textarea.setSelectionRange(newCursorPos, newCursorPos);
                                                                            setShowSuggestions(false);
                                                                        }
                                                                    }}
                                                                >
                                                                    <span className="opacity-50 text-[10px] uppercase w-8 text-right">
                                                                        {tables.some(t => t.name === s) ? 'TBL' : tableStructure.some(c => c.name === s) ? 'COL' : 'KEY'}
                                                                    </span>
                                                                    <span className="font-mono">{s}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                    <div className="absolute bottom-2 right-2 flex items-center gap-2 z-10">
                                                        <span className="text-[10px] text-slate-400 mr-2 hidden sm:inline">Ctrl+Enter to Run</span>
                                                        <button
                                                            onClick={async () => {
                                                                const textarea = document.getElementById('sql-editor-textarea') as HTMLTextAreaElement;
                                                                if (!textarea || !textarea.value.trim()) return;

                                                                const query = textarea.value;
                                                                setLoading(true);
                                                                const result = await dbApi.executeQuery(query);
                                                                setLoading(false);

                                                                if (result.success && result.rows) {
                                                                    setTableData({
                                                                        success: true,
                                                                        table_name: selectedTable || 'Result',
                                                                        columns: result.columns,
                                                                        rows: result.rows,
                                                                        sql_query: query,
                                                                        execution_time: (result.execution_time_ms || 0) / 1000,
                                                                        pagination: undefined
                                                                    });
                                                                } else {
                                                                    setError(result.error || 'Query execution failed');
                                                                }
                                                            }}
                                                            className="bg-primary-600 hover:bg-primary-700 text-white px-3 py-1 rounded text-xs font-medium shadow-sm transition-colors flex items-center gap-1"
                                                        >
                                                            <Play size={10} fill="currentColor" /> Run
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* SQL Options Bar */}
                                            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 mb-2">
                                                <label className="flex items-center gap-1 cursor-pointer">
                                                    <input type="checkbox" className="rounded text-primary-600 focus:ring-primary-500 border-gray-300" />
                                                    Profiling
                                                </label>
                                                <span className="text-slate-300">|</span>
                                                <button
                                                    onClick={() => document.getElementById('sql-editor-textarea')?.focus()}
                                                    className="hover:text-primary-600 hover:underline"
                                                >
                                                    [ Edit inline ]
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        const query = tableData?.sql_query;
                                                        if (query) {
                                                            setSqlTabInitialQuery(query);
                                                            setActiveTab('sql');
                                                        }
                                                    }}
                                                    className="hover:text-primary-600 hover:underline"
                                                >
                                                    [ Edit ]
                                                </button>
                                                <button
                                                    onClick={async () => {
                                                        const query = tableData?.sql_query;
                                                        if (!query) return;
                                                        setLoading(true);
                                                        const result = await dbApi.executeQuery(`EXPLAIN ${query}`);
                                                        setLoading(false);

                                                        if (result.success && result.rows) {
                                                            const columns = result.columns || [];
                                                            const rows = result.rows;

                                                            const htmlTable = `
                                                                <div class="overflow-x-auto text-left">
                                                                    <table class="w-full text-xs text-slate-600 border-collapse">
                                                                        <thead>
                                                                            <tr class="bg-slate-100 border-b border-slate-200">
                                                                                ${columns.map((c: string) => `<th class="p-2 border-r border-slate-200 last:border-0">${c}</th>`).join('')}
                                                                            </tr>
                                                                        </thead>
                                                                        <tbody>
                                                                            ${rows.map((r: any) => `
                                                                                <tr class="border-b border-slate-100 last:border-0">
                                                                                    ${columns.map((c: string) => `<td class="p-2 border-r border-slate-100 last:border-0">${r[c] !== null ? r[c] : 'NULL'}</td>`).join('')}
                                                                                </tr>
                                                                            `).join('')}
                                                                        </tbody>
                                                                    </table>
                                                                </div>
                                                            `;

                                                            Swal.fire({
                                                                title: 'Explain SQL',
                                                                html: htmlTable,
                                                                width: '800px',
                                                                confirmButtonText: 'Close'
                                                            });
                                                        } else {
                                                            Swal.fire('Error', result.error || 'Failed to explain query', 'error');
                                                        }
                                                    }}
                                                    className="hover:text-primary-600 hover:underline"
                                                >
                                                    [ Explain SQL ]
                                                </button>
                                                {/* <button
                                                    onClick={() => {
                                                        const query = tableData?.sql_query || '';
                                                        const phpCode = `$sql = "${query.replace(/"/g, '\\"')}";\n$result = $conn->query($sql);`;
                                                        Swal.fire({
                                                            title: 'PHP Code',
                                                            html: `<textarea class="w-full h-32 p-2 text-sm font-mono border rounded outline-none" readonly>${phpCode}</textarea>`,
                                                            confirmButtonText: 'Copy & Close',
                                                            preConfirm: () => {
                                                                navigator.clipboard.writeText(phpCode);
                                                            }
                                                        });
                                                    }}
                                                    className="hover:text-primary-600 hover:underline"
                                                >
                                                    [ Create PHP code ]
                                                </button> */}
                                                <button
                                                    onClick={() => {
                                                        if (selectedTable) {
                                                            loadTableData(selectedTable, page, filters);
                                                        }
                                                    }}
                                                    className="hover:text-primary-600 hover:underline"
                                                >
                                                    [ Refresh ]
                                                </button>
                                            </div>

                                        </div>
                                    )}

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
                                        <div className="flex-1 flex items-center justify-center py-20">
                                            <Loader2 className="animate-spin text-primary-600" size={32} />
                                        </div>
                                    ) : (
                                        <div className="bg-white rounded-lg border border-slate-200 shadow-sm flex flex-col">
                                            <div>
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
                                                        {tableData?.rows?.map((row, i) => {
                                                            const isRowEditing = editingRowPk === getPrimaryKeyValue(row);

                                                            return (
                                                                <tr key={i} className={`border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors group ${isRowEditing ? 'bg-blue-50' : ''}`}>
                                                                    <td className="px-4 py-2 relative whitespace-nowrap">
                                                                        {isRowEditing ? (
                                                                            <div className="flex gap-1">
                                                                                <button onClick={saveRowEdit} className="p-1 text-green-600 hover:bg-green-100 rounded" title="Save">
                                                                                    <Save size={14} />
                                                                                </button>
                                                                                <button onClick={cancelRowEdit} className="p-1 text-red-500 hover:bg-red-100 rounded" title="Cancel">
                                                                                    <X size={14} />
                                                                                </button>
                                                                            </div>
                                                                        ) : (
                                                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                                <button onClick={() => handleRowEditClick(row)} className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Edit Row">
                                                                                    <Pencil size={14} />
                                                                                </button>
                                                                                <button onClick={() => deleteRow(row)} className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="Delete Row">
                                                                                    <Trash2 size={14} />
                                                                                </button>
                                                                            </div>
                                                                        )}
                                                                    </td>
                                                                    {tableData.columns.map(col => {
                                                                        // Row Edit Mode
                                                                        if (isRowEditing) {
                                                                            const isPk = primaryKeys.includes(col);
                                                                            const isAutoIncrement = tableStructure.find(c => c.name === col)?.autoincrement;
                                                                            const disabled = isPk && isAutoIncrement; // Can we edit PKs? Usually unsafe if it's the identifier. Let's disable for now.

                                                                            return (
                                                                                <td key={col} className="px-4 py-2">
                                                                                    <input
                                                                                        value={editingRowData[col] || ''}
                                                                                        onChange={e => setEditingRowData({ ...editingRowData, [col]: e.target.value })}
                                                                                        className={`w-full px-2 py-1 border rounded text-sm bg-white ${disabled ? 'bg-slate-100 text-slate-400' : 'border-blue-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none'}`}
                                                                                        disabled={!!disabled}
                                                                                    />
                                                                                </td>
                                                                            );
                                                                        }

                                                                        // Normal Mode (Cell Edit support)
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
                                                                                    // Raw value display with Timestamp Hover
                                                                                    (() => {
                                                                                        let titleHex = undefined;
                                                                                        const numVal = Number(val);
                                                                                        if (val !== null && !isNaN(numVal) && typeof val !== 'boolean') {
                                                                                            // Check for likely timestamp (Seconds: > Year 2000, < Year 2100; Milliseconds: corresponding range)
                                                                                            // Year 2000 (s): 946684800 | (ms): 946684800000
                                                                                            // Year 2100 (s): 4102444800 | (ms): 4102444800000
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
                            {activeTab === 'sql' && <SQLTab tableName={selectedTable} initialSql={sqlTabInitialQuery} />}
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

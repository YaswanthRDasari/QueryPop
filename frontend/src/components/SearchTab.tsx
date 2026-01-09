import React, { useState, useEffect } from 'react';
import { tableApi } from '../services/api';
import { Search, Loader2 } from 'lucide-react';
import type { ColumnInfo } from '../types';

interface SearchTabProps {
    tableName: string;
    onSearch: (filters: Record<string, string>) => void;
}

type FilterOperator = 'LIKE' | '=' | '!=' | '>' | '<' | '>=' | '<=' | 'IS NULL' | 'IS NOT NULL';

const OPERATORS: FilterOperator[] = ['LIKE', '=', '!=', '>', '<', '>=', '<=', 'IS NULL', 'IS NOT NULL'];

const OPERATOR_LABELS: Record<FilterOperator, string> = {
    'LIKE': 'LIKE %...%',
    '=': '=',
    '!=': '!=',
    '>': '>',
    '<': '<',
    '>=': '>=',
    '<=': '<=',
    'IS NULL': 'IS NULL',
    'IS NOT NULL': 'IS NOT NULL'
};

export const SearchTab: React.FC<SearchTabProps> = ({ tableName, onSearch }) => {
    const [columns, setColumns] = useState<ColumnInfo[]>([]);
    const [filters, setFilters] = useState<Record<string, string>>({});
    const [operators, setOperators] = useState<Record<string, FilterOperator>>({});
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        loadStructure();
    }, [tableName]);

    const loadStructure = async () => {
        setLoading(true);
        const result = await tableApi.getTableStructure(tableName);
        if (result.success && result.columns) {
            setColumns(result.columns);
            // Initialize empty filters and default operators
            const initialFilters: Record<string, string> = {};
            const initialOperators: Record<string, FilterOperator> = {};
            result.columns.forEach((col: ColumnInfo) => {
                initialFilters[col.name] = '';
                initialOperators[col.name] = 'LIKE';
            });
            setFilters(initialFilters);
            setOperators(initialOperators);
        }
        setLoading(false);
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        // Filter out empty strings and include operator information
        const activeFilters: Record<string, string> = {};
        Object.entries(filters).forEach(([k, v]) => {
            const operator = operators[k];
            // For IS NULL and IS NOT NULL, we don't need a value
            if (operator === 'IS NULL' || operator === 'IS NOT NULL') {
                activeFilters[k] = `${operator}`;
            } else if (v.trim()) {
                // For LIKE operator, wrap value with %
                if (operator === 'LIKE') {
                    activeFilters[k] = `${operator} %${v.trim()}%`;
                } else {
                    activeFilters[k] = `${operator} ${v.trim()}`;
                }
            }
        });

        onSearch(activeFilters);
    };

    if (loading) return <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-slate-400" /></div>;

    return (
        <div className="p-6 max-w-3xl mx-auto">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100 bg-slate-50">
                    <h3 className="font-semibold text-slate-800">Search in table `{tableName}`</h3>
                    <p className="text-xs text-slate-500 mt-1">Leave fields empty to ignore them.</p>
                </div>

                <form onSubmit={handleSearch} className="p-6 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {columns.map(col => (
                            <div key={col.name} className="space-y-1">
                                <label className="block text-xs font-semibold text-slate-500 uppercase">{col.name}</label>
                                <div className="flex gap-2">
                                    <select
                                        className="w-28 text-xs border border-slate-200 rounded px-2 bg-white text-slate-700 focus:ring-2 focus:ring-primary-500 outline-none"
                                        value={operators[col.name] || 'LIKE'}
                                        onChange={(e) => setOperators({ ...operators, [col.name]: e.target.value as FilterOperator })}
                                    >
                                        {OPERATORS.map(op => (
                                            <option key={op} value={op}>{OPERATOR_LABELS[op]}</option>
                                        ))}
                                    </select>
                                    <input
                                        type="text"
                                        value={filters[col.name] || ''}
                                        onChange={e => setFilters({ ...filters, [col.name]: e.target.value })}
                                        className="flex-1 border border-slate-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none disabled:bg-slate-100 disabled:text-slate-400"
                                        placeholder={
                                            operators[col.name] === 'IS NULL' || operators[col.name] === 'IS NOT NULL'
                                                ? 'N/A'
                                                : `Value for ${col.name}`
                                        }
                                        disabled={operators[col.name] === 'IS NULL' || operators[col.name] === 'IS NOT NULL'}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="pt-4 flex justify-end">
                        <button
                            type="submit"
                            className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
                        >
                            <Search size={16} />
                            Search
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

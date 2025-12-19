import React, { useState, useEffect } from 'react';
import { tableApi } from '../services/api';
import { Search, Loader2 } from 'lucide-react';
import type { ColumnInfo } from '../types';

interface SearchTabProps {
    tableName: string;
    onSearch: (filters: Record<string, string>) => void;
}

export const SearchTab: React.FC<SearchTabProps> = ({ tableName, onSearch }) => {
    const [columns, setColumns] = useState<ColumnInfo[]>([]);
    const [filters, setFilters] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        loadStructure();
    }, [tableName]);

    const loadStructure = async () => {
        setLoading(true);
        const result = await tableApi.getTableStructure(tableName);
        if (result.success && result.columns) {
            setColumns(result.columns);
            // Initialize empty filters
            const initial: Record<string, string> = {};
            result.columns.forEach((col: ColumnInfo) => {
                initial[col.name] = '';
            });
            setFilters(initial);
        }
        setLoading(false);
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        // Filter out empty strings
        const activeFilters: Record<string, string> = {};
        Object.entries(filters).forEach(([k, v]) => {
            if (v.trim()) activeFilters[k] = v.trim();
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
                                    <select className="w-24 text-xs border border-slate-200 rounded px-2 bg-slate-50 text-slate-500" disabled>
                                        <option>LIKE %...%</option>
                                    </select>
                                    <input
                                        type="text"
                                        value={filters[col.name] || ''}
                                        onChange={e => setFilters({ ...filters, [col.name]: e.target.value })}
                                        className="flex-1 border border-slate-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                                        placeholder={`Value for ${col.name}`}
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

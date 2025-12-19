import React, { useEffect, useState } from 'react';
import { tableApi } from '../services/api';
import type { ColumnInfo } from '../types';
import { Loader2, Key, Table as TableIcon } from 'lucide-react';

interface StructureTabProps {
    tableName: string;
}

interface TableStructure {
    columns: ColumnInfo[];
    primary_keys: string[];
    indexes: any[];
    foreign_keys: any[];
}

export const StructureTab: React.FC<StructureTabProps> = ({ tableName }) => {
    const [structure, setStructure] = useState<TableStructure | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        loadStructure();
    }, [tableName]);

    const loadStructure = async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await tableApi.getTableStructure(tableName);
            if (result.success) {
                setStructure(result);
            } else {
                setError(result.error || 'Failed to load structure');
            }
        } catch (err) {
            setError('Failed to load structure');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center p-12">
                <Loader2 className="animate-spin text-primary-600" size={32} />
            </div>
        );
    }

    if (error) {
        return <div className="text-red-600 p-4 bg-red-50 rounded-lg border border-red-200">{error}</div>;
    }

    if (!structure) return null;

    return (
        <div className="p-6 space-y-8">
            {/* Columns */}
            <div>
                <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                    <TableIcon size={20} /> Columns
                </h3>
                <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="px-4 py-3 font-semibold text-slate-500 uppercase">Name</th>
                                <th className="px-4 py-3 font-semibold text-slate-500 uppercase">Type</th>
                                <th className="px-4 py-3 font-semibold text-slate-500 uppercase">Attributes</th>
                                <th className="px-4 py-3 font-semibold text-slate-500 uppercase">Default</th>
                            </tr>
                        </thead>
                        <tbody>
                            {structure.columns.map((col) => (
                                <tr key={col.name} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                                    <td className="px-4 py-2 font-mono text-slate-700 font-medium">
                                        {col.name}
                                        {structure.primary_keys.includes(col.name) && (
                                            <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                                                <Key size={10} className="mr-1" /> PK
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-4 py-2 text-slate-600">{col.type}</td>
                                    <td className="px-4 py-2 text-slate-500 text-xs">
                                        <div className="flex gap-2">
                                            {!col.nullable && <span className="bg-red-50 text-red-700 px-1.5 rounded">NOT NULL</span>}
                                            {col.autoincrement && <span className="bg-blue-50 text-blue-700 px-1.5 rounded">AUTO_INCREMENT</span>}
                                        </div>
                                    </td>
                                    <td className="px-4 py-2 text-slate-500 font-mono text-xs">
                                        {col.default !== null ? String(col.default) : <span className="italic text-slate-400">NULL</span>}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Indexes */}
            {structure.indexes && structure.indexes.length > 0 && (
                <div>
                    <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                        Indexes
                    </h3>
                    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 border-b border-slate-200">
                                <tr>
                                    <th className="px-4 py-3 font-semibold text-slate-500 uppercase">Key Name</th>
                                    <th className="px-4 py-3 font-semibold text-slate-500 uppercase">Type</th>
                                    <th className="px-4 py-3 font-semibold text-slate-500 uppercase">Columns</th>
                                </tr>
                            </thead>
                            <tbody>
                                {structure.indexes.map((idx, i) => (
                                    <tr key={i} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                                        <td className="px-4 py-2 font-mono text-slate-700">{idx.name}</td>
                                        <td className="px-4 py-2 text-slate-600">
                                            {idx.unique ? <span className="text-orange-600 font-medium">UNIQUE</span> : 'INDEX'}
                                        </td>
                                        <td className="px-4 py-2 font-mono text-slate-600 text-xs">
                                            {idx.columns.join(', ')}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

import React from 'react';
import { MOCK_FILES } from '../services/mockData';
import { Folder, File, MoreVertical, Download, Clock } from 'lucide-react';

export const Files: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-900">Files & Assets</h2>
        <div className="flex gap-2">
            <button className="bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition">
            New Folder
            </button>
            <button className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition">
            Upload
            </button>
        </div>
      </div>

      {/* Breadcrumb mock */}
      <div className="flex items-center text-sm text-slate-500 pb-2 border-b border-slate-200">
        <span className="hover:text-indigo-600 cursor-pointer">Project Root</span>
        <span className="mx-2">/</span>
        <span className="font-semibold text-slate-900">Design Assets</span>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
                <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Size</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Version</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Updated</th>
                    <th className="relative px-6 py-3"><span className="sr-only">Actions</span></th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
                {/* Mock Folder */}
                <tr className="hover:bg-slate-50 cursor-pointer">
                    <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                            <Folder className="w-5 h-5 text-indigo-400 fill-indigo-100" />
                            <span className="text-sm font-medium text-slate-900">Old Concepts</span>
                        </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500">-</td>
                    <td className="px-6 py-4 text-sm text-slate-500">-</td>
                    <td className="px-6 py-4 text-sm text-slate-500">2 days ago</td>
                    <td className="px-6 py-4 text-right"></td>
                </tr>
                {/* Files */}
                {MOCK_FILES.map(file => (
                     <tr key={file.id} className="hover:bg-slate-50 group">
                        <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-3">
                                <File className="w-5 h-5 text-slate-400" />
                                <span className="text-sm font-medium text-slate-900">{file.name}</span>
                            </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-500">{file.size}</td>
                        <td className="px-6 py-4">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-indigo-50 text-indigo-700">
                                <Clock className="w-3 h-3" />
                                v{file.version}
                            </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-500">{new Date(file.updatedAt).toLocaleDateString()}</td>
                        <td className="px-6 py-4 text-right">
                            <div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition">
                                <button className="text-slate-400 hover:text-indigo-600"><Download className="w-4 h-4" /></button>
                                <button className="text-slate-400 hover:text-slate-600"><MoreVertical className="w-4 h-4" /></button>
                            </div>
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
      </div>
    </div>
  );
};
import React from 'react';
import { MOCK_INVOICES } from '../services/mockData';
import { StatusBadge } from '../components/StatusBadge';
import { Receipt, UploadCloud, Download } from 'lucide-react';

export const Billing: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-900">Billing & Invoices</h2>
        <button className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition">
          Issue Invoice
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {MOCK_INVOICES.map(invoice => (
            <div key={invoice.id} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                    <div className="p-3 bg-slate-100 rounded-xl">
                        <Receipt className="w-6 h-6 text-slate-600" />
                    </div>
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <h3 className="text-lg font-bold text-slate-900">{invoice.invoiceNumber}</h3>
                            <StatusBadge status={invoice.status} />
                        </div>
                        <p className="text-sm text-slate-500">Due: {new Date(invoice.dueAt).toLocaleDateString()}</p>
                    </div>
                </div>

                <div className="text-left sm:text-right">
                    <p className="text-sm text-slate-500">Amount Due</p>
                    <p className="text-2xl font-bold text-slate-900">
                        {new Intl.NumberFormat('ko-KR', { style: 'currency', currency: invoice.currency }).format(invoice.amount)}
                    </p>
                </div>

                <div className="flex items-center gap-2 pt-4 sm:pt-0 border-t sm:border-t-0 sm:border-l border-slate-100 sm:pl-6">
                    {invoice.status === 'ISSUED' && (
                        <button className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50">
                            <UploadCloud className="w-4 h-4" />
                            Upload Proof
                        </button>
                    )}
                    <button className="p-2 text-slate-400 hover:text-indigo-600 transition">
                        <Download className="w-5 h-5" />
                    </button>
                </div>
            </div>
        ))}
      </div>
    </div>
  );
};
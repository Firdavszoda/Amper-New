import React from 'react';
import type { Transaction, Station } from '../types';

interface TransactionsTableProps {
  transactions: Transaction[];
  stations: Station[];
}

const TransactionsTable: React.FC<TransactionsTableProps> = ({ transactions, stations }) => {
  const getStationName = (id: number) => stations.find(s => s.id === id)?.name || 'Unknown';

  const statusStyles = {
    pending: 'text-gray-500 bg-gray-50 dark:bg-gray-500/10',
    charging: 'text-blue-500 bg-blue-50 dark:bg-blue-500/10',
    completed: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10',
  };

  const statusLabels = {
    pending: 'Ожидание',
    charging: 'Зарядка',
    completed: 'Завершено',
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-gray-100 dark:border-app-border">
            <th className="py-4 px-4 text-[10px] font-bold uppercase tracking-wider text-gray-400">ID</th>
            <th className="py-4 px-4 text-[10px] font-bold uppercase tracking-wider text-gray-400">Станция</th>
            <th className="py-4 px-4 text-[10px] font-bold uppercase tracking-wider text-gray-400 text-right">Сумма (TJS)</th>
            <th className="py-4 px-4 text-[10px] font-bold uppercase tracking-wider text-gray-400 text-right">Энергия (kWh)</th>
            <th className="py-4 px-4 text-[10px] font-bold uppercase tracking-wider text-gray-400 text-center">Статус</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((tx) => (
            <tr 
              key={tx.id} 
              className="border-b border-gray-50 dark:border-app-border hover:bg-gray-50 dark:hover:bg-app-bg/50 transition-colors group"
            >
              <td className="py-4 px-4 text-sm font-medium text-gray-400 font-mono">#{tx.id}</td>
              <td className="py-4 px-4 text-sm font-bold text-gray-900 dark:text-white">
                {getStationName(tx.station_id)}
              </td>
              <td className="py-4 px-4 text-sm font-bold text-gray-900 dark:text-white text-right font-mono">
                {tx.amount_tjs.toFixed(2)}
              </td>
              <td className="py-4 px-4 text-sm font-bold text-gray-900 dark:text-white text-right font-mono">
                {tx.consumed_kwh.toFixed(2)}
              </td>
              <td className="py-4 px-4 text-center">
                <span className={`inline-flex px-2 py-1 rounded-md text-[10px] font-bold uppercase ${statusStyles[tx.status]}`}>
                  {statusLabels[tx.status]}
                </span>
              </td>
            </tr>
          ))}
          {transactions.length === 0 && (
            <tr>
              <td colSpan={5} className="py-12 text-center text-gray-400 text-sm">
                Транзакции не найдены
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default TransactionsTable;

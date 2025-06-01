import { format } from 'date-fns';
import {
  ClipboardDocumentCheckIcon,
  EyeIcon,
  PencilIcon,
  BanknotesIcon,
  UserIcon,
  ShieldCheckIcon,
  DocumentTextIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';

interface AuditEntry {
  id: string;
  timestamp: Date;
  action: string;
  user: string;
  details: string;
  ipAddress?: string;
  userAgent?: string;
}

interface AuditTrailProps {
  entries: AuditEntry[];
}

const actionIcons: Record<string, any> = {
  LOAN_CREATED: DocumentTextIcon,
  LOAN_VIEWED: EyeIcon,
  LOAN_MODIFIED: PencilIcon,
  PAYMENT_RECORDED: BanknotesIcon,
  STATUS_CHANGED: ArrowPathIcon,
  USER_ACTION: UserIcon,
  COMPLIANCE_CHECK: ShieldCheckIcon,
  MODIFICATION_APPROVED: ClipboardDocumentCheckIcon,
};

const actionColors: Record<string, string> = {
  LOAN_CREATED: 'bg-green-100 text-green-800',
  LOAN_VIEWED: 'bg-blue-100 text-blue-800',
  LOAN_MODIFIED: 'bg-yellow-100 text-yellow-800',
  PAYMENT_RECORDED: 'bg-green-100 text-green-800',
  STATUS_CHANGED: 'bg-purple-100 text-purple-800',
  USER_ACTION: 'bg-gray-100 text-gray-800',
  COMPLIANCE_CHECK: 'bg-indigo-100 text-indigo-800',
  MODIFICATION_APPROVED: 'bg-green-100 text-green-800',
};

export const AuditTrail = ({ entries }: AuditTrailProps) => {
  return (
    <div className="bg-white shadow rounded-lg">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-medium text-gray-900">Audit Trail</h3>
        <p className="mt-1 text-sm text-gray-500">
          Complete history of all actions taken on this loan
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Date & Time
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Action
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                User
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Details
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {entries.map((entry) => {
              const Icon = actionIcons[entry.action] || DocumentTextIcon;
              const colorClass = actionColors[entry.action] || 'bg-gray-100 text-gray-800';

              return (
                <tr key={entry.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {format(entry.timestamp, 'MMM d, yyyy HH:mm:ss')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <span className={`inline-flex items-center justify-center h-8 w-8 rounded-full ${colorClass}`}>
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="ml-3 text-sm font-medium text-gray-900">
                        {entry.action.replace(/_/g, ' ')}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {entry.user}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {entry.details}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {entries.length === 0 && (
        <div className="text-center py-12">
          <ClipboardDocumentCheckIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No audit entries</h3>
          <p className="mt-1 text-sm text-gray-500">
            Audit trail will appear here as actions are taken.
          </p>
        </div>
      )}
    </div>
  );
};
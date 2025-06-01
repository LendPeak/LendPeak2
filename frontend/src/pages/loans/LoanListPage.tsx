import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { MagnifyingGlassIcon, PlusIcon, BanknotesIcon, PencilIcon } from '@heroicons/react/24/outline';
import apiClient from '../../services/api';
import { useAuth } from '../../store/auth-context';
import { useTimeTravel } from '../../contexts/TimeTravelContext';
import { formatCurrency } from '../../utils/formatters';
import { RecordPayment } from '../../components/loans/RecordPayment';
import { LoanStatusManager } from '../../components/loans/LoanStatusManager';

const statusColors = {
  ACTIVE: 'bg-green-100 text-green-800',
  DEFAULTED: 'bg-red-100 text-red-800',
  PAID_OFF: 'bg-blue-100 text-blue-800',
  DELINQUENT: 'bg-yellow-100 text-yellow-800',
  FORBEARANCE: 'bg-purple-100 text-purple-800',
};

export const LoanListPage = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [selectedLoanForPayment, setSelectedLoanForPayment] = useState<any>(null);
  const [selectedLoanForStatus, setSelectedLoanForStatus] = useState<any>(null);
  const { hasRole } = useAuth();
  const { asOfDate } = useTimeTravel();

  const { data, isLoading } = useQuery({
    queryKey: ['loans', { page, status: statusFilter, asOfDate: asOfDate?.toISOString() }],
    queryFn: () => apiClient.getLoans({ 
      page, 
      limit: 20, 
      status: statusFilter, 
      asOfDate: asOfDate?.toISOString() 
    }),
  });

  const filteredLoans = data?.data.filter(loan =>
    loan.loanNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    loan.borrower?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const canCreateLoan = hasRole('LOAN_OFFICER') || hasRole('ADMIN') || hasRole('SUPER_ADMIN');

  return (
    <div>
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-semibold text-gray-900">Loans</h1>
          <p className="mt-2 text-sm text-gray-700">
            A list of all loans including their status, principal amount, and payment information.
          </p>
        </div>
        {canCreateLoan && (
          <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
            <Link
              to="/loans/new"
              className="inline-flex items-center justify-center rounded-md border border-transparent bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 sm:w-auto"
            >
              <PlusIcon className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
              New Loan
            </Link>
          </div>
        )}
      </div>

      <div className="mt-6 flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
              placeholder="Search loans..."
            />
          </div>
        </div>
        <div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md"
          >
            <option value="">All Status</option>
            <option value="ACTIVE">Active</option>
            <option value="DELINQUENT">Delinquent</option>
            <option value="DEFAULTED">Defaulted</option>
            <option value="PAID_OFF">Paid Off</option>
            <option value="FORBEARANCE">Forbearance</option>
          </select>
        </div>
      </div>

      <div className="mt-8 flex flex-col">
        <div className="-my-2 -mx-4 overflow-x-auto sm:-mx-6 lg:-mx-8">
          <div className="inline-block min-w-full py-2 align-middle md:px-6 lg:px-8">
            <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
              <table className="min-w-full divide-y divide-gray-300">
                <thead className="bg-gray-50">
                  <tr>
                    <th
                      scope="col"
                      className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                    >
                      Loan Number
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                    >
                      Borrower
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                    >
                      Principal
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                    >
                      Rate
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                    >
                      Monthly Payment
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                    >
                      Next Payment
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                    >
                      Status
                    </th>
                    <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                      <span className="sr-only">View</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {isLoading ? (
                    <tr>
                      <td colSpan={8} className="text-center py-4">
                        Loading...
                      </td>
                    </tr>
                  ) : filteredLoans.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-4 text-gray-500">
                        No loans found
                      </td>
                    </tr>
                  ) : (
                    filteredLoans.map((loan) => (
                      <tr key={loan.id}>
                        <td className="whitespace-nowrap px-3 py-4 text-sm font-medium text-gray-900">
                          {loan.loanNumber}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          {loan.borrower?.name || 'N/A'}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          {formatCurrency(loan.originalPrincipal)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          {Number(loan.interestRate).toFixed(2)}%
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          {formatCurrency(loan.monthlyPayment)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          {loan.nextPaymentDate
                            ? format(new Date(loan.nextPaymentDate), 'MMM d, yyyy')
                            : 'N/A'}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm">
                          <span
                            className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${
                              statusColors[loan.status as keyof typeof statusColors]
                            }`}
                          >
                            {loan.status}
                          </span>
                        </td>
                        <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                          <div className="flex items-center justify-end space-x-2">
                            <button
                              onClick={() => setSelectedLoanForPayment(loan)}
                              className="text-green-600 hover:text-green-900"
                              title="Record Payment"
                            >
                              <BanknotesIcon className="h-5 w-5" />
                            </button>
                            <button
                              onClick={() => setSelectedLoanForStatus(loan)}
                              className="text-gray-600 hover:text-gray-900"
                              title="Update Status"
                            >
                              <PencilIcon className="h-4 w-4" />
                            </button>
                            <Link
                              to={`/loans/${loan.id}/edit`}
                              className="text-yellow-600 hover:text-yellow-900"
                              title="Edit Loan"
                            >
                              Edit
                            </Link>
                            <Link
                              to={`/loans/${loan.id}`}
                              className="text-primary-600 hover:text-primary-900"
                            >
                              View
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {data && data.total > 20 && (
        <div className="mt-4 flex items-center justify-between">
          <div className="flex-1 flex justify-between sm:hidden">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              onClick={() => setPage(page + 1)}
              disabled={page * 20 >= data.total}
              className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700">
                Showing <span className="font-medium">{(page - 1) * 20 + 1}</span> to{' '}
                <span className="font-medium">{Math.min(page * 20, data.total)}</span> of{' '}
                <span className="font-medium">{data.total}</span> results
              </p>
            </div>
            <div>
              <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage(page + 1)}
                  disabled={page * 20 >= data.total}
                  className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </nav>
            </div>
          </div>
        </div>
      )}
      
      {/* Record Payment Modal */}
      {selectedLoanForPayment && (
        <RecordPayment
          loanId={selectedLoanForPayment.id || selectedLoanForPayment._id}
          loanNumber={selectedLoanForPayment.loanNumber}
          scheduledPaymentAmount={parseFloat(selectedLoanForPayment.monthlyPayment)}
          nextPaymentDate={new Date(selectedLoanForPayment.nextPaymentDate || new Date())}
          currentBalance={parseFloat(selectedLoanForPayment.currentBalance || selectedLoanForPayment.originalPrincipal)}
          onClose={() => setSelectedLoanForPayment(null)}
          onSuccess={() => {
            setSelectedLoanForPayment(null);
            // Refetch loans to update the list
          }}
        />
      )}
      
      {/* Status Manager Modal */}
      {selectedLoanForStatus && (
        <LoanStatusManager
          loanId={selectedLoanForStatus.id || selectedLoanForStatus._id}
          loanNumber={selectedLoanForStatus.loanNumber}
          currentStatus={selectedLoanForStatus.status}
          onClose={() => setSelectedLoanForStatus(null)}
          onSuccess={() => {
            setSelectedLoanForStatus(null);
          }}
        />
      )}
    </div>
  );
};
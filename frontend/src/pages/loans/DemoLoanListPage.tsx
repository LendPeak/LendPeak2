import { useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { MagnifyingGlassIcon, PlusIcon, BanknotesIcon, PencilIcon, EyeIcon } from '@heroicons/react/24/outline';
import { DEMO_CUSTOMERS } from '../../demo/demoData';
import { LoanEngine, toBig } from '@lendpeak/engine';
import { useDemoAuth } from '../../contexts/DemoAuthContext';
import { demoLoanStorage } from '../../services/demoLoanStorage';
import { DemoRecordPayment } from '../../components/loans/DemoRecordPayment';
import { LoanModificationBuilder } from '../../components/loans/LoanModificationBuilder';

const statusColors = {
  ACTIVE: 'bg-green-100 text-green-800',
  DEFAULTED: 'bg-red-100 text-red-800',
  PAID_OFF: 'bg-blue-100 text-blue-800',
  PENDING: 'bg-yellow-100 text-yellow-800',
};

export const DemoLoanListPage = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [selectedLoanForPayment, setSelectedLoanForPayment] = useState<any>(null);
  const [selectedLoanForModification, setSelectedLoanForModification] = useState<any>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showModificationModal, setShowModificationModal] = useState(false);
  const [loans, setLoans] = useState(demoLoanStorage.getLoans());
  const { user } = useDemoAuth();

  const refreshLoans = () => {
    setLoans(demoLoanStorage.getLoans());
  };

  // Filter loans based on search and status
  const filteredLoans = loans.filter(loan => {
    const customer = DEMO_CUSTOMERS.find(c => c.id === loan.customerId);
    const customerName = customer ? `${customer.firstName} ${customer.lastName}` : '';
    
    const matchesSearch = 
      loan.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      loan.purpose.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = !statusFilter || loan.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  // Paginate results
  const itemsPerPage = 10;
  const totalPages = Math.ceil(filteredLoans.length / itemsPerPage);
  const startIndex = (page - 1) * itemsPerPage;
  const paginatedLoans = filteredLoans.slice(startIndex, startIndex + itemsPerPage);

  return (
    <div>
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-semibold text-gray-900">Loans</h1>
          <p className="mt-2 text-sm text-gray-700">
            Demo loans with browser-based calculations. All data is simulated.
          </p>
        </div>
        <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
          <Link
            to="/calculator"
            className="inline-flex items-center justify-center rounded-md border border-transparent bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 sm:w-auto"
          >
            <PlusIcon className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
            New Calculation
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label htmlFor="search" className="block text-sm font-medium text-gray-700">
            Search
          </label>
          <div className="mt-1 relative rounded-md shadow-sm">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
            </div>
            <input
              type="text"
              name="search"
              id="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="focus:ring-primary-500 focus:border-primary-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md"
              placeholder="Search loans..."
            />
          </div>
        </div>

        <div>
          <label htmlFor="status" className="block text-sm font-medium text-gray-700">
            Status
          </label>
          <select
            id="status"
            name="status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md"
          >
            <option value="">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="PENDING">Pending</option>
            <option value="PAID_OFF">Paid Off</option>
            <option value="DEFAULTED">Defaulted</option>
          </select>
        </div>
      </div>

      {/* Loans Table */}
      <div className="mt-8 flex flex-col">
        <div className="-my-2 -mx-4 overflow-x-auto sm:-mx-6 lg:-mx-8">
          <div className="inline-block min-w-full py-2 align-middle md:px-6 lg:px-8">
            <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
              <table className="min-w-full divide-y divide-gray-300">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      Loan ID
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      Customer
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      Purpose
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      Principal
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      Rate
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      Term
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      Status
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      Application Date
                    </th>
                    <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {paginatedLoans.map((loan) => {
                    const customer = DEMO_CUSTOMERS.find(c => c.id === loan.customerId);
                    return (
                      <tr key={loan.id}>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-900">
                          {loan.id}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm">
                          <div>
                            <div className="text-gray-900">
                              {customer?.firstName} {customer?.lastName}
                            </div>
                            <div className="text-gray-500">{customer?.email}</div>
                          </div>
                        </td>
                        <td className="px-3 py-4 text-sm text-gray-900">
                          {loan.purpose}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-900">
                          {LoanEngine.formatCurrency(toBig(loan.loanParameters.principal))}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-900">
                          {LoanEngine.formatPercentage(toBig(loan.loanParameters.interestRate))}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-900">
                          {loan.loanParameters.termMonths} months
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm">
                          <span className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${statusColors[loan.status]}`}>
                            {loan.status}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          {format(loan.applicationDate, 'MMM d, yyyy')}
                        </td>
                        <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                          <div className="flex items-center justify-end space-x-2">
                            <button
                              onClick={() => {
                                setSelectedLoanForPayment(loan);
                                setShowPaymentModal(true);
                              }}
                              className="text-green-600 hover:text-green-900"
                              title="Record Payment"
                            >
                              <BanknotesIcon className="h-5 w-5" />
                            </button>
                            <button
                              onClick={() => {
                                setSelectedLoanForModification(loan);
                                setShowModificationModal(true);
                              }}
                              className="text-gray-600 hover:text-gray-900"
                              title="Modify Loan"
                            >
                              <PencilIcon className="h-4 w-4" />
                            </button>
                            <Link
                              to={`/loans/${loan.id}`}
                              className="text-primary-600 hover:text-primary-900"
                              title="View Details"
                            >
                              <EyeIcon className="h-5 w-5" />
                            </Link>
                            <Link
                              to="/calculator"
                              state={{ template: loan.loanParameters }}
                              className="text-primary-600 hover:text-primary-900"
                            >
                              Calculate
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
          <div className="flex-1 flex justify-between sm:hidden">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
            >
              Next
            </button>
          </div>
          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700">
                Showing <span className="font-medium">{startIndex + 1}</span> to{' '}
                <span className="font-medium">{Math.min(startIndex + itemsPerPage, filteredLoans.length)}</span> of{' '}
                <span className="font-medium">{filteredLoans.length}</span> results
              </p>
            </div>
            <div>
              <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                >
                  Previous
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                      pageNum === page
                        ? 'z-10 bg-primary-50 border-primary-500 text-primary-600'
                        : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    {pageNum}
                  </button>
                ))}
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                >
                  Next
                </button>
              </nav>
            </div>
          </div>
        </div>
      )}

      {/* Demo Notice */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-md p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800">
              Demo Data
            </h3>
            <div className="mt-2 text-sm text-blue-700">
              <p>
                This is simulated loan data for demonstration purposes. 
                Click "Calculate" on any loan to see its amortization schedule.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      {showPaymentModal && selectedLoanForPayment && (
        <DemoRecordPayment
          loan={selectedLoanForPayment}
          onClose={() => {
            setShowPaymentModal(false);
            setSelectedLoanForPayment(null);
          }}
          onSuccess={() => {
            setShowPaymentModal(false);
            setSelectedLoanForPayment(null);
            refreshLoans();
          }}
        />
      )}

      {/* Modification Modal */}
      {showModificationModal && selectedLoanForModification && (
        <LoanModificationBuilder
          loan={selectedLoanForModification}
          isOpen={showModificationModal}
          onClose={() => {
            setShowModificationModal(false);
            setSelectedLoanForModification(null);
          }}
          onSuccess={() => {
            setShowModificationModal(false);
            setSelectedLoanForModification(null);
            refreshLoans();
          }}
        />
      )}
    </div>
  );
};
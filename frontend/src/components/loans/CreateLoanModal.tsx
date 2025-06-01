import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { useNavigate } from 'react-router-dom';

interface CreateLoanModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: {
    principal: number;
    annualRate: number;
    termMonths: number;
    startDate: Date;
    paymentDueDay: number;
    roundingMethod: string;
    calendarType: string;
    accrualTiming: string;
  };
}

export const CreateLoanModal = ({ isOpen, onClose, initialData }: CreateLoanModalProps) => {
  const navigate = useNavigate();

  const handleCreateLoan = () => {
    // Navigate to create loan page with initial data as query params
    const params = new URLSearchParams();
    if (initialData) {
      params.append('principal', initialData.principal.toString());
      params.append('rate', initialData.annualRate.toString());
      params.append('term', initialData.termMonths.toString());
      params.append('paymentDueDay', initialData.paymentDueDay.toString());
      params.append('roundingMethod', initialData.roundingMethod);
      params.append('calendarType', initialData.calendarType);
      params.append('accrualTiming', initialData.accrualTiming);
    }
    navigate(`/loans/new?${params.toString()}`);
  };

  return (
    <Transition.Root show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-10" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
        </Transition.Child>

        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              enterTo="opacity-100 translate-y-0 sm:scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 translate-y-0 sm:scale-100"
              leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            >
              <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white px-4 pt-5 pb-4 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-md sm:p-6">
                <div className="absolute top-0 right-0 pt-4 pr-4">
                  <button
                    type="button"
                    className="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
                    onClick={onClose}
                  >
                    <span className="sr-only">Close</span>
                    <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                  </button>
                </div>
                <div className="sm:flex sm:items-start">
                  <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                    <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900">
                      Create Loan from Calculator
                    </Dialog.Title>
                    <div className="mt-4">
                      <p className="text-sm text-gray-500">
                        Would you like to create a new loan with the parameters from your calculation?
                      </p>
                      {initialData && (
                        <div className="mt-4 bg-gray-50 rounded-md p-4">
                          <h4 className="text-sm font-medium text-gray-900 mb-2">Loan Parameters:</h4>
                          <dl className="text-sm space-y-1">
                            <div className="flex justify-between">
                              <dt className="text-gray-500">Principal:</dt>
                              <dd className="font-medium">${initialData.principal.toLocaleString()}</dd>
                            </div>
                            <div className="flex justify-between">
                              <dt className="text-gray-500">Interest Rate:</dt>
                              <dd className="font-medium">{initialData.annualRate}%</dd>
                            </div>
                            <div className="flex justify-between">
                              <dt className="text-gray-500">Term:</dt>
                              <dd className="font-medium">{initialData.termMonths} months</dd>
                            </div>
                            <div className="flex justify-between">
                              <dt className="text-gray-500">Payment Due Day:</dt>
                              <dd className="font-medium">{initialData.paymentDueDay}</dd>
                            </div>
                          </dl>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                  <button
                    type="button"
                    className="inline-flex w-full justify-center rounded-md border border-transparent bg-primary-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 sm:ml-3 sm:w-auto sm:text-sm"
                    onClick={handleCreateLoan}
                  >
                    Continue to Create Loan
                  </button>
                  <button
                    type="button"
                    className="mt-3 inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 sm:mt-0 sm:w-auto sm:text-sm"
                    onClick={onClose}
                  >
                    Cancel
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
};
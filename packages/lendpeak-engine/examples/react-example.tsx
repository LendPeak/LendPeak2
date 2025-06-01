import React, { useState, useMemo } from 'react';
import { LoanEngine, LoanTerms } from '@lendpeak/engine';

interface LoanCalculatorProps {
  defaultPrincipal?: number;
  defaultRate?: number;
  defaultTerm?: number;
}

export const LoanCalculator: React.FC<LoanCalculatorProps> = ({
  defaultPrincipal = 250000,
  defaultRate = 4.5,
  defaultTerm = 360,
}) => {
  const [principal, setPrincipal] = useState(defaultPrincipal);
  const [rate, setRate] = useState(defaultRate);
  const [termMonths, setTermMonths] = useState(defaultTerm);
  
  // Calculate loan details using the engine
  const { loan, payment, schedule } = useMemo(() => {
    try {
      const loan = LoanEngine.createLoan(
        principal,
        rate,
        termMonths,
        new Date().toISOString().split('T')[0]
      );
      
      const payment = LoanEngine.calculatePayment(loan);
      const schedule = LoanEngine.generateSchedule(loan);
      
      return { loan, payment, schedule };
    } catch (error) {
      console.error('Calculation error:', error);
      return { loan: null, payment: null, schedule: null };
    }
  }, [principal, rate, termMonths]);
  
  if (!loan || !payment || !schedule) {
    return <div>Invalid loan parameters</div>;
  }
  
  return (
    <div className="loan-calculator">
      <h2>Loan Calculator</h2>
      
      <div className="inputs">
        <label>
          Principal Amount:
          <input
            type="number"
            value={principal}
            onChange={(e) => setPrincipal(Number(e.target.value))}
            min="1000"
            max="10000000"
            step="1000"
          />
        </label>
        
        <label>
          Annual Interest Rate (%):
          <input
            type="number"
            value={rate}
            onChange={(e) => setRate(Number(e.target.value))}
            min="0"
            max="30"
            step="0.125"
          />
        </label>
        
        <label>
          Term (months):
          <input
            type="number"
            value={termMonths}
            onChange={(e) => setTermMonths(Number(e.target.value))}
            min="12"
            max="600"
            step="12"
          />
        </label>
      </div>
      
      <div className="results">
        <h3>Loan Summary</h3>
        <p>Monthly Payment: {LoanEngine.formatCurrency(payment.monthlyPayment)}</p>
        <p>Total Interest: {LoanEngine.formatCurrency(payment.totalInterest)}</p>
        <p>Total Payments: {LoanEngine.formatCurrency(payment.totalPayments)}</p>
        <p>Effective APR: {LoanEngine.formatPercentage(payment.effectiveInterestRate)}</p>
      </div>
      
      <div className="schedule">
        <h3>Amortization Schedule (First 12 Payments)</h3>
        <table>
          <thead>
            <tr>
              <th>Payment #</th>
              <th>Date</th>
              <th>Payment</th>
              <th>Principal</th>
              <th>Interest</th>
              <th>Balance</th>
            </tr>
          </thead>
          <tbody>
            {schedule.payments.slice(0, 12).map((payment) => (
              <tr key={payment.paymentNumber}>
                <td>{payment.paymentNumber}</td>
                <td>{LoanEngine.formatDate(payment.dueDate, 'MM/DD/YYYY')}</td>
                <td>{LoanEngine.formatCurrency(payment.totalPayment)}</td>
                <td>{LoanEngine.formatCurrency(payment.principal)}</td>
                <td>{LoanEngine.formatCurrency(payment.interest)}</td>
                <td>{LoanEngine.formatCurrency(payment.remainingBalance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Example usage in App component
export const App: React.FC = () => {
  return (
    <div className="app">
      <h1>Mortgage Calculator</h1>
      <LoanCalculator />
    </div>
  );
};
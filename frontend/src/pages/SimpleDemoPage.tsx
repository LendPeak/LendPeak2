/**
 * Simple Demo Page - Fast loading without Material-UI
 */

import React, { useState, useEffect } from 'react';
import { demoDataService, DemoLoan } from '../services/demoDataService';

export default function SimpleDemoPage() {
  const [loans, setLoans] = useState<DemoLoan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const demoLoans = await demoDataService.getLoans();
        setLoans(demoLoans);
      } catch (error) {
        console.error('Error loading demo data:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, []);

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <h1>Demo Showcase</h1>
        <p>Loading demo data...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px' }}>
      <h1>Simple Demo Showcase</h1>
      <p>Fast-loading demo page with {loans.length} loans</p>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginTop: '20px' }}>
        {loans.map((loan) => (
          <div key={loan.id} style={{ border: '1px solid #ccc', padding: '15px', borderRadius: '8px' }}>
            <h3>{loan.scenario.name}</h3>
            <p>{loan.scenario.description}</p>
            <div>
              <strong>Loan #:</strong> {loan.loanNumber}
            </div>
            <div>
              <strong>Principal:</strong> ${loan.scenario.loanParameters.principal.toLocaleString()}
            </div>
            <div>
              <strong>Rate:</strong> {loan.scenario.loanParameters.interestRate}%
            </div>
            <div>
              <strong>Term:</strong> {loan.scenario.loanParameters.termMonths} months
            </div>
            <div>
              <strong>Status:</strong> {loan.currentState.status}
            </div>
            <div>
              <strong>Current Balance:</strong> ${loan.currentState.currentBalance.toLocaleString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
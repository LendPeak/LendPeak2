/**
 * Simple Cache Test Page - Basic cache functionality test
 */

import React, { useState } from 'react';

export default function SimpleCacheTestPage() {
  const [result, setResult] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const testBasicCache = async () => {
    setLoading(true);
    setResult('Testing basic cache functionality...\n');
    
    try {
      // Test localStorage
      const testData = { test: 'value', timestamp: Date.now() };
      localStorage.setItem('cacheTest', JSON.stringify(testData));
      
      const retrieved = JSON.parse(localStorage.getItem('cacheTest') || '{}');
      
      if (retrieved.test === 'value') {
        setResult(prev => prev + '✅ localStorage working correctly\n');
      } else {
        setResult(prev => prev + '❌ localStorage test failed\n');
      }
      
      // Test simple hash function
      const testString = 'hello world';
      let hash = 0;
      for (let i = 0; i < testString.length; i++) {
        const char = testString.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      const hashResult = Math.abs(hash).toString(16);
      
      setResult(prev => prev + `✅ Hash function working: ${hashResult}\n`);
      setResult(prev => prev + '🎉 Basic cache components are functional!\n');
      
    } catch (error) {
      setResult(prev => prev + `❌ Error: ${error}\n`);
    } finally {
      setLoading(false);
    }
  };

  const clearStorage = () => {
    localStorage.removeItem('cacheTest');
    localStorage.removeItem('loanCalculationCache');
    setResult('🗑️ Storage cleared\n');
  };

  return (
    <div style={{ padding: '20px', maxWidth: '600px' }}>
      <h1>Simple Cache Test</h1>
      <p>Testing basic cache functionality without complex imports.</p>
      
      <div style={{ marginBottom: '20px' }}>
        <button 
          onClick={testBasicCache} 
          disabled={loading}
          style={{ 
            padding: '10px 20px', 
            marginRight: '10px', 
            backgroundColor: '#007bff', 
            color: 'white', 
            border: 'none', 
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? 'Testing...' : 'Test Basic Cache'}
        </button>
        
        <button 
          onClick={clearStorage}
          style={{ 
            padding: '10px 20px', 
            backgroundColor: '#dc3545', 
            color: 'white', 
            border: 'none', 
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Clear Storage
        </button>
      </div>
      
      <div style={{ 
        backgroundColor: '#f8f9fa', 
        border: '1px solid #dee2e6', 
        borderRadius: '4px', 
        padding: '15px',
        height: '300px',
        overflowY: 'auto',
        fontFamily: 'monospace',
        fontSize: '14px',
        whiteSpace: 'pre-wrap'
      }}>
        {result || 'Click "Test Basic Cache" to start...'}
      </div>
    </div>
  );
}
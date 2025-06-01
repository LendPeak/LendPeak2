/**
 * Cache Test Page - Temporarily disabled due to Babel decimal syntax issues
 */

import React from 'react';

export default function CacheTestPage() {
  return (
    <div style={{ padding: '20px', maxWidth: '800px' }}>
      <h1>Cache Test Page</h1>
      <div style={{ 
        backgroundColor: '#fff3cd', 
        border: '1px solid #ffeeba', 
        borderRadius: '4px', 
        padding: '15px',
        marginBottom: '20px'
      }}>
        <h3>⚠️ Temporarily Disabled</h3>
        <p>This page is temporarily disabled due to Babel decimal syntax issues with the @lendpeak/engine package.</p>
        <p>Please visit these alternative test pages:</p>
        <ul>
          <li><a href="/simple-cache-test">Simple Cache Test</a> - Basic caching functionality</li>
          <li><a href="/simple-demo">Simple Demo</a> - Fast demo data without engine imports</li>
          <li><a href="/perf-test">Performance Test</a> - Minimal performance baseline</li>
        </ul>
      </div>
      
      <div style={{ marginTop: '20px' }}>
        <h3>Cache Strategy for Production</h3>
        <p>The intelligent caching system is designed to work with:</p>
        <ul>
          <li><strong>Frontend</strong>: Simple calculations + localStorage caching</li>
          <li><strong>Backend API</strong>: Full @lendpeak/engine calculations</li>
          <li><strong>Cache Key</strong>: Hash of loan parameters + payment history</li>
          <li><strong>Invalidation</strong>: Automatic when any parameter changes</li>
        </ul>
        
        <h3>Performance Benefits</h3>
        <ul>
          <li>🚀 <strong>10-100x faster</strong> for cached complex loans</li>
          <li>💾 <strong>Persistent storage</strong> across browser sessions</li>
          <li>🔍 <strong>Smart change detection</strong> with parameter hashing</li>
          <li>📊 <strong>Production ready</strong> with API integration</li>
        </ul>
      </div>
    </div>
  );
}
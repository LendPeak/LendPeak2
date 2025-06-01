/**
 * Simple Performance Test Page
 * Minimal page to test loading speed
 */

import React from 'react';

export default function PerformanceTestPage() {
  return (
    <div style={{ padding: '20px' }}>
      <h1>Performance Test Page</h1>
      <p>This page should load very quickly.</p>
      <p>If this page is slow, the issue is not with demo data.</p>
      <p>Load time: {Date.now()}</p>
    </div>
  );
}
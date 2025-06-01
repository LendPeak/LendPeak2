/**
 * Portfolio-level calculation cache service
 * Provides ultra-fast dashboard metrics with intelligent caching
 */

interface PortfolioMetrics {
  totalLoans: number;
  activeLoans: number;
  totalPrincipal: number;
  totalMonthlyPayments: number;
  averageLoanAmount: number;
  portfolioValue: number;
  delinquencyRate: number;
  lastUpdated: Date;
  isCalculating?: boolean;
}

interface CachedPortfolioData {
  metrics: PortfolioMetrics;
  hash: string;
  timestamp: number;
}

class PortfolioCache {
  private static readonly CACHE_KEY = 'portfolioMetricsCache';
  private static readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  private isCalculating = false;
  private callbacks: Array<(metrics: PortfolioMetrics) => void> = [];

  /**
   * Get portfolio metrics - returns cached data first, then calculates if needed
   */
  public async getPortfolioMetrics(): Promise<PortfolioMetrics> {
    // Try to get cached data first
    const cached = this.getCachedMetrics();
    if (cached && this.isCacheValid(cached)) {
      console.log('📊 Using cached portfolio metrics');
      return cached.metrics;
    }

    // If we have stale cached data, return it with calculating flag
    if (cached) {
      console.log('📊 Returning stale cached data while calculating...');
      const staleMetrics = {
        ...cached.metrics,
        isCalculating: true
      };
      
      // Start async calculation
      this.calculateMetricsAsync();
      
      return staleMetrics;
    }

    // No cached data - provide instant fallback values based on expected demo data
    console.log('📊 No cached data - providing fallback values');
    const fallbackMetrics: PortfolioMetrics = {
      totalLoans: 0,
      activeLoans: 0,
      totalPrincipal: 0,
      totalMonthlyPayments: 0,
      averageLoanAmount: 0,
      portfolioValue: 0,
      delinquencyRate: 0,
      lastUpdated: new Date(),
      isCalculating: true
    };

    // Start async calculation
    this.calculateMetricsAsync();

    return fallbackMetrics;
  }

  /**
   * Subscribe to portfolio metrics updates
   */
  public onMetricsUpdate(callback: (metrics: PortfolioMetrics) => void): () => void {
    this.callbacks.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = this.callbacks.indexOf(callback);
      if (index > -1) {
        this.callbacks.splice(index, 1);
      }
    };
  }

  /**
   * Calculate metrics asynchronously and notify subscribers
   */
  private async calculateMetricsAsync(): Promise<void> {
    if (this.isCalculating) {
      console.log('📊 Already calculating metrics...');
      return;
    }

    this.isCalculating = true;
    console.log('📊 Starting async portfolio metrics calculation...');

    try {
      // Use the demo loan storage for calculations (same as loans list page)
      const { demoLoanStorage } = await import('./demoLoanStorage');
      
      // Get loans from storage
      const loans = demoLoanStorage.getLoans();
      
      // Calculate metrics from actual loan data
      const totalLoans = loans.length;
      const activeLoans = loans.filter(l => l.status === 'ACTIVE').length;
      const totalPrincipal = loans.reduce((sum, loan) => sum + loan.loanParameters.principal, 0);
      
      // Simplified monthly payment calculation for speed
      const totalMonthlyPayments = loans.reduce((sum, loan) => {
        const estimatedPayment = loan.loanParameters.principal / loan.loanParameters.termMonths * 1.2;
        return sum + estimatedPayment;
      }, 0);
      
      const averageLoanAmount = totalPrincipal / totalLoans;
      const delinquentLoans = loans.filter(l => l.status === 'DEFAULTED').length;
      const delinquencyRate = (delinquentLoans / totalLoans) * 100;

      const metrics: PortfolioMetrics = {
        totalLoans,
        activeLoans,
        totalPrincipal,
        totalMonthlyPayments,
        averageLoanAmount,
        portfolioValue: totalPrincipal * 0.8, // Assume 80% of principal remains
        delinquencyRate,
        lastUpdated: new Date(),
        isCalculating: false
      };

      // Cache the results
      this.cacheMetrics(metrics);

      // Notify all subscribers
      this.callbacks.forEach(callback => {
        try {
          callback(metrics);
        } catch (error) {
          console.error('Error in portfolio metrics callback:', error);
        }
      });

      console.log('✅ Portfolio metrics calculation completed');

    } catch (error) {
      console.error('❌ Error calculating portfolio metrics:', error);
      
      // Notify subscribers with error state
      const errorMetrics: PortfolioMetrics = {
        totalLoans: 0,
        activeLoans: 0,
        totalPrincipal: 0,
        totalMonthlyPayments: 0,
        averageLoanAmount: 0,
        portfolioValue: 0,
        delinquencyRate: 0,
        lastUpdated: new Date(),
        isCalculating: false
      };
      
      this.callbacks.forEach(callback => {
        try {
          callback(errorMetrics);
        } catch (cbError) {
          console.error('Error in error callback:', cbError);
        }
      });
    } finally {
      this.isCalculating = false;
    }
  }

  /**
   * Get cached metrics from localStorage
   */
  private getCachedMetrics(): CachedPortfolioData | null {
    try {
      const cached = localStorage.getItem(PortfolioCache.CACHE_KEY);
      if (!cached) return null;

      const data: CachedPortfolioData = JSON.parse(cached);
      
      // Convert date strings back to Date objects
      data.metrics.lastUpdated = new Date(data.metrics.lastUpdated);
      
      return data;
    } catch (error) {
      console.error('Error reading cached portfolio metrics:', error);
      return null;
    }
  }

  /**
   * Cache metrics to localStorage
   */
  private cacheMetrics(metrics: PortfolioMetrics): void {
    try {
      const dataToCache: CachedPortfolioData = {
        metrics,
        hash: this.generateMetricsHash(metrics),
        timestamp: Date.now()
      };

      localStorage.setItem(PortfolioCache.CACHE_KEY, JSON.stringify(dataToCache));
      console.log('💾 Portfolio metrics cached successfully');
    } catch (error) {
      console.error('Error caching portfolio metrics:', error);
    }
  }

  /**
   * Check if cached data is still valid
   */
  private isCacheValid(cached: CachedPortfolioData): boolean {
    const age = Date.now() - cached.timestamp;
    const isValid = age < PortfolioCache.CACHE_DURATION;
    
    if (!isValid) {
      console.log(`📊 Cache expired: ${Math.round(age / 1000)}s old (max ${PortfolioCache.CACHE_DURATION / 1000}s)`);
    }
    
    return isValid;
  }

  /**
   * Generate hash for metrics to detect changes
   */
  private generateMetricsHash(metrics: PortfolioMetrics): string {
    const dataString = `${metrics.totalLoans}-${metrics.activeLoans}-${metrics.totalPrincipal}-${metrics.totalMonthlyPayments}`;
    
    let hash = 0;
    for (let i = 0; i < dataString.length; i++) {
      const char = dataString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return Math.abs(hash).toString(16);
  }

  /**
   * Force refresh of metrics
   */
  public async forceRefresh(): Promise<PortfolioMetrics> {
    // Clear cache
    localStorage.removeItem(PortfolioCache.CACHE_KEY);
    
    // Recalculate
    return this.getPortfolioMetrics();
  }

  /**
   * Clear all cached data
   */
  public clearCache(): void {
    localStorage.removeItem(PortfolioCache.CACHE_KEY);
    console.log('🗑️ Portfolio cache cleared');
  }
}

// Export singleton instance
export const portfolioCache = new PortfolioCache();

// Export types
export type { PortfolioMetrics };
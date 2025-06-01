import { useState, useEffect } from 'react';
import { useTimeTravel } from '../../contexts/TimeTravelContext';
import {
  DocumentTextIcon,
  CalendarIcon,
  ArrowDownTrayIcon,
  EyeIcon,
  ChartBarIcon,
  DocumentArrowDownIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';
import { format, startOfYear, endOfYear } from 'date-fns';
import { apiClient } from '../../utils/api-client';

interface StatementViewerProps {
  loanId: string;
  loanNumber?: string;
}

interface StatementHistory {
  id: string;
  type: 'monthly' | 'year-end' | 'payoff';
  generatedDate: Date;
  statementDate: Date;
  filename: string;
  downloadUrl: string;
}

export const StatementViewer: React.FC<StatementViewerProps> = ({ loanId, loanNumber }) => {
  const [statements, setStatements] = useState<StatementHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState<string | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const { asOfDate } = useTimeTravel();
  
  const [generateForm, setGenerateForm] = useState({
    type: 'monthly' as 'monthly' | 'year-end' | 'payoff',
    statementDate: format(new Date(), 'yyyy-MM-dd'),
    year: new Date().getFullYear(),
    effectiveDate: format(new Date(), 'yyyy-MM-dd'),
    format: 'PDF' as 'PDF' | 'HTML'
  });

  useEffect(() => {
    loadStatementHistory();
  }, [loanId]);

  const loadStatementHistory = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get(`/statements/history/${loanId}`);
      const data = response.data.data.map((stmt: any) => ({
        ...stmt,
        generatedDate: new Date(stmt.generatedDate),
        statementDate: new Date(stmt.statementDate)
      }));
      setStatements(data);
    } catch (error) {
      console.error('Failed to load statement history:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateStatement = async () => {
    setGenerating(generateForm.type);
    try {
      let url = '';
      let payload: any = {};

      switch (generateForm.type) {
        case 'monthly':
          url = `/statements/monthly/${loanId}`;
          payload = {
            statementDate: generateForm.statementDate,
            format: generateForm.format
          };
          break;
        case 'year-end':
          url = `/statements/year-end/${loanId}`;
          payload = {
            year: generateForm.year,
            format: generateForm.format
          };
          break;
        case 'payoff':
          url = `/statements/payoff/${loanId}`;
          payload = {
            effectiveDate: generateForm.effectiveDate,
            format: generateForm.format
          };
          break;
      }

      const response = await apiClient.post(url, payload, {
        responseType: generateForm.format === 'PDF' ? 'blob' : 'text'
      });

      if (generateForm.format === 'PDF') {
        // Download PDF
        const blob = new Blob([response.data], { type: 'application/pdf' });
        const downloadUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = `${generateForm.type}-${loanNumber || loanId}-${
          generateForm.type === 'year-end' ? generateForm.year : 
          generateForm.type === 'payoff' ? generateForm.effectiveDate :
          format(new Date(generateForm.statementDate), 'yyyy-MM')
        }.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(downloadUrl);
      } else {
        // Show HTML preview
        setPreviewHtml(response.data);
        setShowPreview(true);
      }

      // Refresh history
      await loadStatementHistory();
    } catch (error) {
      console.error('Failed to generate statement:', error);
    } finally {
      setGenerating(null);
    }
  };

  const previewStatement = async () => {
    setGenerating(`${generateForm.type}-preview`);
    try {
      const payload: any = { type: generateForm.type };

      switch (generateForm.type) {
        case 'monthly':
          payload.statementDate = generateForm.statementDate;
          break;
        case 'year-end':
          payload.year = generateForm.year;
          break;
        case 'payoff':
          payload.effectiveDate = generateForm.effectiveDate;
          break;
      }

      const response = await apiClient.post(`/statements/preview/${loanId}`, payload, {
        responseType: 'text'
      });

      setPreviewHtml(response.data);
      setShowPreview(true);
    } catch (error) {
      console.error('Failed to preview statement:', error);
    } finally {
      setGenerating(null);
    }
  };

  const downloadStatement = async (statement: StatementHistory) => {
    try {
      // In a real implementation, this would download from the stored URL
      console.log('Downloading statement:', statement.filename);
    } catch (error) {
      console.error('Failed to download statement:', error);
    }
  };

  const getStatementIcon = (type: string) => {
    switch (type) {
      case 'monthly':
        return DocumentTextIcon;
      case 'year-end':
        return ChartBarIcon;
      case 'payoff':
        return DocumentArrowDownIcon;
      default:
        return DocumentTextIcon;
    }
  };

  const getStatementColor = (type: string) => {
    switch (type) {
      case 'monthly':
        return 'bg-blue-50 text-blue-600 border-blue-200';
      case 'year-end':
        return 'bg-green-50 text-green-600 border-green-200';
      case 'payoff':
        return 'bg-purple-50 text-purple-600 border-purple-200';
      default:
        return 'bg-gray-50 text-gray-600 border-gray-200';
    }
  };

  if (showPreview && previewHtml) {
    return (
      <div className="fixed inset-0 bg-white z-50 overflow-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">Statement Preview</h2>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => {
                setGenerateForm({ ...generateForm, format: 'PDF' });
                generateStatement();
              }}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700"
            >
              <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
              Download PDF
            </button>
            <button
              onClick={() => setShowPreview(false)}
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              Close Preview
            </button>
          </div>
        </div>
        <div className="p-6">
          <div 
            className="bg-white border border-gray-200 rounded-lg shadow-sm"
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white shadow-lg rounded-lg">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <DocumentTextIcon className="h-6 w-6 mr-3 text-primary-600" />
            Loan Statements
          </h3>
          {asOfDate && (
            <div className="flex items-center space-x-2 text-sm text-amber-600 bg-amber-50 px-3 py-1 rounded-md">
              <ClockIcon className="h-4 w-4" />
              <span>As of {format(asOfDate, 'MMM d, yyyy')}</span>
            </div>
          )}
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Statement Generation Form */}
        <div className="bg-gray-50 rounded-lg p-6">
          <h4 className="text-md font-medium text-gray-900 mb-4">Generate New Statement</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Statement Type
              </label>
              <select
                value={generateForm.type}
                onChange={(e) => setGenerateForm({ 
                  ...generateForm, 
                  type: e.target.value as 'monthly' | 'year-end' | 'payoff' 
                })}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="monthly">Monthly Statement</option>
                <option value="year-end">Year-End Tax Statement</option>
                <option value="payoff">Payoff Quote</option>
              </select>
            </div>

            {generateForm.type === 'monthly' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Statement Date
                </label>
                <input
                  type="date"
                  value={generateForm.statementDate}
                  onChange={(e) => setGenerateForm({ ...generateForm, statementDate: e.target.value })}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            )}

            {generateForm.type === 'year-end' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tax Year
                </label>
                <select
                  value={generateForm.year}
                  onChange={(e) => setGenerateForm({ ...generateForm, year: parseInt(e.target.value) })}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                >
                  {[...Array(10)].map((_, i) => {
                    const year = new Date().getFullYear() - i;
                    return (
                      <option key={year} value={year}>{year}</option>
                    );
                  })}
                </select>
              </div>
            )}

            {generateForm.type === 'payoff' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Effective Date
                </label>
                <input
                  type="date"
                  value={generateForm.effectiveDate}
                  onChange={(e) => setGenerateForm({ ...generateForm, effectiveDate: e.target.value })}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                  min={format(new Date(), 'yyyy-MM-dd')}
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Format
              </label>
              <select
                value={generateForm.format}
                onChange={(e) => setGenerateForm({ 
                  ...generateForm, 
                  format: e.target.value as 'PDF' | 'HTML' 
                })}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="PDF">PDF Download</option>
                <option value="HTML">HTML Preview</option>
              </select>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={previewStatement}
              disabled={generating !== null}
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
            >
              <EyeIcon className="h-4 w-4 mr-2" />
              {generating?.includes('preview') ? 'Generating...' : 'Preview'}
            </button>
            
            <button
              onClick={generateStatement}
              disabled={generating !== null}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50"
            >
              <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
              {generating === generateForm.type ? 'Generating...' : 'Generate Statement'}
            </button>
          </div>
        </div>

        {/* Statement History */}
        <div>
          <h4 className="text-md font-medium text-gray-900 mb-4">Statement History</h4>
          
          {loading ? (
            <div className="text-center py-8">
              <ClockIcon className="mx-auto h-8 w-8 text-gray-400 animate-spin" />
              <p className="mt-2 text-sm text-gray-500">Loading statements...</p>
            </div>
          ) : statements.length === 0 ? (
            <div className="text-center py-8">
              <DocumentTextIcon className="mx-auto h-12 w-12 text-gray-400" />
              <p className="mt-2 text-sm text-gray-500">No statements generated yet</p>
              <p className="text-xs text-gray-400">Generate your first statement using the form above</p>
            </div>
          ) : (
            <div className="space-y-3">
              {statements.map((statement) => {
                const IconComponent = getStatementIcon(statement.type);
                const colorClass = getStatementColor(statement.type);
                
                return (
                  <div
                    key={statement.id}
                    className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                  >
                    <div className="flex items-center space-x-4">
                      <div className={`w-10 h-10 rounded-lg border flex items-center justify-center ${colorClass}`}>
                        <IconComponent className="h-5 w-5" />
                      </div>
                      
                      <div>
                        <h5 className="text-sm font-medium text-gray-900 capitalize">
                          {statement.type.replace('-', ' ')} Statement
                        </h5>
                        <div className="flex items-center space-x-4 text-xs text-gray-500">
                          <span className="flex items-center">
                            <CalendarIcon className="h-3 w-3 mr-1" />
                            {format(statement.statementDate, 'MMM d, yyyy')}
                          </span>
                          <span>Generated {format(statement.generatedDate, 'MMM d, yyyy')}</span>
                        </div>
                      </div>
                    </div>
                    
                    <button
                      onClick={() => downloadStatement(statement)}
                      className="inline-flex items-center px-3 py-1 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
                    >
                      <ArrowDownTrayIcon className="h-3 w-3 mr-1" />
                      Download
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Time Travel Warning */}
        {asOfDate && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-start">
              <ExclamationTriangleIcon className="h-5 w-5 text-amber-400 mt-0.5 mr-3" />
              <div>
                <h4 className="text-sm font-medium text-amber-800">Time Travel Mode Active</h4>
                <p className="text-sm text-amber-700 mt-1">
                  Statements generated will reflect loan data as of {format(asOfDate, 'MMMM d, yyyy')}. 
                  This affects balance calculations, payment history, and transaction data.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
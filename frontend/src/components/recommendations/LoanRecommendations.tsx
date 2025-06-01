import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  CurrencyDollarIcon,
  ClockIcon,
  CheckCircleIcon,
  InformationCircleIcon,
  LightBulbIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline';
import { useForm } from 'react-hook-form';
import { apiClient as api } from '../../services/api';
import { clsx } from 'clsx';

interface UserProfile {
  creditScore: number;
  annualIncome: number;
  employmentYears: number;
  existingDebt: number;
  purpose: string;
  homeOwnership?: string;
}

interface LoanRecommendation {
  productName: string;
  recommendedAmount: string;
  interestRate: string;
  term: number;
  monthlyPayment: string;
  totalInterest: string;
  score: number;
  reasons: string[];
  modelConfidence?: number;
}

interface LoanPrediction {
  successProbability: number;
  riskScore: number;
  factors: Array<{
    factor: string;
    impact: 'positive' | 'negative' | 'neutral';
    weight: number;
  }>;
}

export const LoanRecommendations: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'recommendations' | 'affordability' | 'tips'>('recommendations');
  const [recommendations, setRecommendations] = useState<LoanRecommendation[]>([]);
  const [prediction, setPrediction] = useState<LoanPrediction | null>(null);

  const { register, handleSubmit, watch, formState: { errors } } = useForm<UserProfile>();

  // Get recommendations mutation
  const getRecommendationsMutation = useMutation({
    mutationFn: (profile: UserProfile) => 
      api.post('/recommendations/loan-products', profile).then(res => res.data.data),
    onSuccess: (data) => {
      setRecommendations(data);
    },
  });

  // Predict success mutation
  const predictSuccessMutation = useMutation({
    mutationFn: (application: any) => 
      api.post('/recommendations/predict-success', application).then(res => res.data.data),
    onSuccess: (data) => {
      setPrediction(data);
    },
  });

  // Affordability calculation mutation
  const affordabilityMutation = useMutation({
    mutationFn: (profile: any) => 
      api.post('/recommendations/affordability', profile).then(res => res.data.data),
  });

  // Tips query
  const { data: tips } = useQuery({
    queryKey: ['recommendations', 'tips'],
    queryFn: () => api.get('/recommendations/tips').then(res => res.data.data),
  });

  const onSubmit = async (data: UserProfile) => {
    await getRecommendationsMutation.mutateAsync(data);
    
    // Also get success prediction
    await predictSuccessMutation.mutateAsync({
      ...data,
      requestedAmount: Number(recommendations[0]?.recommendedAmount || 20000),
      term: recommendations[0]?.term || 60,
    });
  };

  const calculateAffordability = async () => {
    const formData = watch();
    const monthlyIncome = formData.annualIncome / 12;
    
    await affordabilityMutation.mutateAsync({
      monthlyIncome,
      monthlyExpenses: monthlyIncome * 0.3, // Estimate
      existingDebtPayments: formData.existingDebt * 0.03, // Estimate
      creditScore: formData.creditScore,
    });
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900">Loan Recommendations</h1>
        <p className="mt-2 text-lg text-gray-600">
          Get personalized loan recommendations based on your financial profile
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'recommendations', name: 'Recommendations', icon: ChartBarIcon },
            { id: 'affordability', name: 'Affordability', icon: CurrencyDollarIcon },
            { id: 'tips', name: 'Tips', icon: LightBulbIcon },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={clsx(
                'flex items-center py-2 px-1 border-b-2 font-medium text-sm',
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              )}
            >
              <tab.icon className="h-5 w-5 mr-2" />
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      {/* Profile Form */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Your Financial Profile</h2>
        <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Credit Score
            </label>
            <input
              type="number"
              {...register('creditScore', { 
                required: 'Credit score is required',
                min: { value: 300, message: 'Minimum credit score is 300' },
                max: { value: 850, message: 'Maximum credit score is 850' }
              })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              placeholder="720"
            />
            {errors.creditScore && (
              <p className="mt-1 text-sm text-red-600">{errors.creditScore.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Annual Income
            </label>
            <input
              type="number"
              {...register('annualIncome', { 
                required: 'Annual income is required',
                min: { value: 0, message: 'Income cannot be negative' }
              })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              placeholder="75000"
            />
            {errors.annualIncome && (
              <p className="mt-1 text-sm text-red-600">{errors.annualIncome.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Employment Years
            </label>
            <input
              type="number"
              {...register('employmentYears', { 
                required: 'Employment years is required',
                min: { value: 0, message: 'Cannot be negative' }
              })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              placeholder="5"
            />
            {errors.employmentYears && (
              <p className="mt-1 text-sm text-red-600">{errors.employmentYears.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Existing Debt
            </label>
            <input
              type="number"
              {...register('existingDebt', { 
                required: 'Existing debt is required',
                min: { value: 0, message: 'Cannot be negative' }
              })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              placeholder="15000"
            />
            {errors.existingDebt && (
              <p className="mt-1 text-sm text-red-600">{errors.existingDebt.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Loan Purpose
            </label>
            <select
              {...register('purpose', { required: 'Loan purpose is required' })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="">Select purpose</option>
              <option value="debt_consolidation">Debt Consolidation</option>
              <option value="home_improvement">Home Improvement</option>
              <option value="auto">Auto</option>
              <option value="personal">Personal</option>
              <option value="business">Business</option>
              <option value="medical">Medical</option>
              <option value="vacation">Vacation</option>
              <option value="other">Other</option>
            </select>
            {errors.purpose && (
              <p className="mt-1 text-sm text-red-600">{errors.purpose.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Home Ownership
            </label>
            <select
              {...register('homeOwnership')}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="">Select status</option>
              <option value="own">Own</option>
              <option value="rent">Rent</option>
              <option value="mortgage">Mortgage</option>
            </select>
          </div>

          <div className="sm:col-span-2 lg:col-span-3">
            <div className="flex space-x-4">
              <button
                type="submit"
                disabled={getRecommendationsMutation.isPending}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {getRecommendationsMutation.isPending ? 'Getting Recommendations...' : 'Get Recommendations'}
              </button>

              <button
                type="button"
                onClick={calculateAffordability}
                disabled={affordabilityMutation.isPending}
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                {affordabilityMutation.isPending ? 'Calculating...' : 'Check Affordability'}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Tab Content */}
      {activeTab === 'recommendations' && (
        <div className="space-y-6">
          {/* Success Prediction */}
          {prediction && (
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Loan Success Prediction</h3>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600">
                    {(prediction.successProbability * 100).toFixed(0)}%
                  </div>
                  <div className="text-sm text-gray-500">Success Probability</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-red-600">
                    {prediction.riskScore}
                  </div>
                  <div className="text-sm text-gray-500">Risk Score</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600">
                    {prediction.factors.filter(f => f.impact === 'positive').length}
                  </div>
                  <div className="text-sm text-gray-500">Positive Factors</div>
                </div>
              </div>

              <div className="mt-6">
                <h4 className="text-sm font-medium text-gray-900 mb-2">Key Factors</h4>
                <div className="space-y-2">
                  {prediction.factors.slice(0, 5).map((factor, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <span className="text-sm text-gray-700">{factor.factor}</span>
                      <span className={clsx(
                        'text-xs px-2 py-1 rounded-full',
                        factor.impact === 'positive' 
                          ? 'bg-green-100 text-green-800'
                          : factor.impact === 'negative'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-gray-100 text-gray-800'
                      )}>
                        {factor.impact}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Recommendations */}
          {recommendations.length > 0 && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              {recommendations.map((rec, index) => (
                <div key={index} className="bg-white shadow rounded-lg overflow-hidden">
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-medium text-gray-900">{rec.productName}</h3>
                      <div className="flex items-center">
                        <span className="text-sm text-gray-500 mr-2">Score:</span>
                        <span className="text-lg font-bold text-blue-600">{rec.score}</span>
                      </div>
                    </div>

                    <dl className="space-y-3">
                      <div className="flex justify-between">
                        <dt className="text-sm text-gray-500">Loan Amount</dt>
                        <dd className="text-sm font-medium text-gray-900">
                          ${Number(rec.recommendedAmount).toLocaleString()}
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-sm text-gray-500">Interest Rate</dt>
                        <dd className="text-sm font-medium text-gray-900">{rec.interestRate}%</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-sm text-gray-500">Term</dt>
                        <dd className="text-sm font-medium text-gray-900">{rec.term} months</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-sm text-gray-500">Monthly Payment</dt>
                        <dd className="text-sm font-medium text-gray-900">
                          ${Number(rec.monthlyPayment).toLocaleString()}
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-sm text-gray-500">Total Interest</dt>
                        <dd className="text-sm font-medium text-gray-900">
                          ${Number(rec.totalInterest).toLocaleString()}
                        </dd>
                      </div>
                    </dl>

                    <div className="mt-4">
                      <h4 className="text-sm font-medium text-gray-900 mb-2">Why this loan?</h4>
                      <ul className="text-xs text-gray-600 space-y-1">
                        {rec.reasons.map((reason, i) => (
                          <li key={i} className="flex items-start">
                            <CheckCircleIcon className="h-3 w-3 text-green-500 mt-0.5 mr-1 flex-shrink-0" />
                            {reason}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {rec.modelConfidence && (
                      <div className="mt-4 flex items-center text-xs text-gray-500">
                        <InformationCircleIcon className="h-4 w-4 mr-1" />
                        Model confidence: {(rec.modelConfidence * 100).toFixed(0)}%
                      </div>
                    )}
                  </div>

                  <div className="px-6 py-4 bg-gray-50">
                    <button className="w-full bg-blue-600 text-white py-2 px-4 rounded-md text-sm font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                      Apply for This Loan
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'affordability' && (
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Affordability Analysis</h3>
          {affordabilityMutation.data && (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              <div className="text-center p-4 border rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  ${Number(affordabilityMutation.data.maxLoanAmount).toLocaleString()}
                </div>
                <div className="text-sm text-gray-500">Maximum Loan Amount</div>
              </div>
              <div className="text-center p-4 border rounded-lg">
                <div className="text-2xl font-bold text-blue-600">
                  ${Number(affordabilityMutation.data.maxMonthlyPayment).toLocaleString()}
                </div>
                <div className="text-sm text-gray-500">Max Monthly Payment</div>
              </div>
              <div className="text-center p-4 border rounded-lg">
                <div className="text-2xl font-bold text-yellow-600">
                  {affordabilityMutation.data.debtToIncomeRatio}%
                </div>
                <div className="text-sm text-gray-500">Debt-to-Income Ratio</div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'tips' && (
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Personalized Tips</h3>
          {tips && tips.length > 0 ? (
            <div className="space-y-4">
              {tips.map((tip: any, index: number) => (
                <div key={index} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start">
                      <LightBulbIcon className="h-5 w-5 text-yellow-500 mt-1 mr-3 flex-shrink-0" />
                      <div>
                        <h4 className="font-medium text-gray-900">{tip.tip}</h4>
                        <p className="text-sm text-gray-600 mt-1">{tip.potentialImpact}</p>
                      </div>
                    </div>
                    <span className={clsx(
                      'text-xs px-2 py-1 rounded-full',
                      tip.priority === 'high' 
                        ? 'bg-red-100 text-red-800'
                        : tip.priority === 'medium'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-green-100 text-green-800'
                    )}>
                      {tip.priority}
                    </span>
                  </div>
                  <div className="mt-3">
                    <h5 className="text-sm font-medium text-gray-700">Action Items:</h5>
                    <ul className="mt-1 text-xs text-gray-600 list-disc list-inside">
                      {tip.actionItems.map((item: string, i: number) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">No personalized tips available. Fill out your profile to get recommendations.</p>
          )}
        </div>
      )}
    </div>
  );
};
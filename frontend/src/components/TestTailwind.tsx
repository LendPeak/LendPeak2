import React from 'react';

export const TestTailwind: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto">
        <div className="bg-white overflow-hidden shadow-xl rounded-lg">
          <div className="bg-blue-600 px-4 py-5 sm:px-6">
            <h3 className="text-lg leading-6 font-medium text-white">
              Tailwind CSS Test
            </h3>
            <p className="mt-1 max-w-2xl text-sm text-blue-200">
              If you can see this styled card, Tailwind is working!
            </p>
          </div>
          <div className="px-4 py-5 sm:p-6">
            <div className="space-y-4">
              <button className="w-full bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition duration-200">
                Primary Button
              </button>
              <button className="w-full bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded transition duration-200">
                Secondary Button
              </button>
              <div className="grid grid-cols-3 gap-4">
                <div className="h-12 bg-red-400 rounded"></div>
                <div className="h-12 bg-green-400 rounded"></div>
                <div className="h-12 bg-blue-400 rounded"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
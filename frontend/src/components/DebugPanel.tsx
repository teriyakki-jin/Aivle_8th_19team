import React from 'react';
import { debugAwsEnvironment } from '../utils/auth';

export function DebugPanel() {
  const [showDebug, setShowDebug] = React.useState(false);

  const handleDebugToggle = () => {
    debugAwsEnvironment();
    setShowDebug(!showDebug);
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <button
        onClick={handleDebugToggle}
        className="bg-red-500 text-white px-3 py-2 rounded text-sm hover:bg-red-600"
      >
        Debug
      </button>
      
      {showDebug && (
        <div className="absolute bottom-full right-0 mb-2 bg-gray-900 text-white p-4 rounded shadow-lg text-xs max-w-md">
          <h3 className="font-bold mb-2">Debug Info</h3>
          <div>Environment: {import.meta.env.MODE}</div>
          <div>Production: {String(import.meta.env.PROD)}</div>
          <div>API Base: {import.meta.env.VITE_API_BASE || 'undefined'}</div>
          <div>Current URL: {window.location.href}</div>
          <div>Token: {localStorage.getItem('token') ? 'Present' : 'Missing'}</div>
          <button 
            onClick={() => setShowDebug(false)}
            className="mt-2 bg-gray-700 px-2 py-1 rounded text-xs"
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}
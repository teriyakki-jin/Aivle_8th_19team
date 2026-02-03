import { useState } from 'react';

// Stub for simulation data hook
export function useSimulationData(enabled: boolean) {
  const [loading] = useState(false);

  return {
    data: null,
    prediction: null,
    loading,
  };
}
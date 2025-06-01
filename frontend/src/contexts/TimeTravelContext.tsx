import React, { createContext, useContext, useState, useCallback } from 'react';
import { format, isAfter, isBefore, startOfDay, endOfDay } from 'date-fns';

interface TimeTravelContextType {
  asOfDate: Date | null;
  isTimeTravelActive: boolean;
  mode: 'HISTORICAL' | 'CURRENT' | 'FUTURE';
  setAsOfDate: (date: Date | null) => void;
  resetToPresent: () => void;
  formattedAsOfDate: string;
}

const TimeTravelContext = createContext<TimeTravelContextType | undefined>(undefined);

export const TimeTravelProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [asOfDate, setAsOfDateState] = useState<Date | null>(null);
  
  const today = startOfDay(new Date());
  const isTimeTravelActive = asOfDate !== null;
  
  let mode: 'HISTORICAL' | 'CURRENT' | 'FUTURE' = 'CURRENT';
  if (asOfDate) {
    if (isBefore(startOfDay(asOfDate), today)) {
      mode = 'HISTORICAL';
    } else if (isAfter(startOfDay(asOfDate), today)) {
      mode = 'FUTURE';
    }
  }

  const setAsOfDate = useCallback((date: Date | null) => {
    if (date) {
      // Set to end of day for consistent queries
      setAsOfDateState(endOfDay(date));
    } else {
      setAsOfDateState(null);
    }
  }, []);

  const resetToPresent = useCallback(() => {
    setAsOfDateState(null);
  }, []);

  const formattedAsOfDate = asOfDate ? format(asOfDate, 'MMM d, yyyy') : 'Current';

  return (
    <TimeTravelContext.Provider
      value={{
        asOfDate,
        isTimeTravelActive,
        mode,
        setAsOfDate,
        resetToPresent,
        formattedAsOfDate,
      }}
    >
      {children}
    </TimeTravelContext.Provider>
  );
};

export const useTimeTravel = () => {
  const context = useContext(TimeTravelContext);
  if (context === undefined) {
    throw new Error('useTimeTravel must be used within a TimeTravelProvider');
  }
  return context;
};
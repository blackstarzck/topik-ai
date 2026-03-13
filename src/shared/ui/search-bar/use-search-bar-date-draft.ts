import { useCallback, useEffect, useState } from 'react';

type SearchBarDateDraft = {
  draftStartDate: string;
  draftEndDate: string;
  handleDraftDateChange: (startDate: string, endDate: string) => void;
  handleDraftReset: () => void;
  handleDetailOpenChange: (open: boolean) => void;
};

export function useSearchBarDateDraft(
  appliedStartDate: string,
  appliedEndDate: string
): SearchBarDateDraft {
  const [draftStartDate, setDraftStartDate] = useState(appliedStartDate);
  const [draftEndDate, setDraftEndDate] = useState(appliedEndDate);

  useEffect(() => {
    setDraftStartDate(appliedStartDate);
    setDraftEndDate(appliedEndDate);
  }, [appliedEndDate, appliedStartDate]);

  const handleDraftDateChange = useCallback(
    (startDate: string, endDate: string) => {
      setDraftStartDate(startDate);
      setDraftEndDate(endDate);
    },
    []
  );

  const handleDraftReset = useCallback(() => {
    setDraftStartDate('');
    setDraftEndDate('');
  }, []);

  const handleDetailOpenChange = useCallback(
    (open: boolean) => {
      if (open) {
        return;
      }

      setDraftStartDate(appliedStartDate);
      setDraftEndDate(appliedEndDate);
    },
    [appliedEndDate, appliedStartDate]
  );

  return {
    draftStartDate,
    draftEndDate,
    handleDraftDateChange,
    handleDraftReset,
    handleDetailOpenChange
  };
}

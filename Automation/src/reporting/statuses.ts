// Execution status vocabulary shared by the results CSV, the run scripts and the output workbook.
export const STATUS = {
    Pass: 'Pass',
    Fail: 'Fail',
    Skip: 'Skip',
    Blocked: 'Blocked',
    NotExecuted: 'Not Executed',
} as const;

export type ExecutionStatus = (typeof STATUS)[keyof typeof STATUS];

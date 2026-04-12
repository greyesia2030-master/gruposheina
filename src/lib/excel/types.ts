export interface ParsedOption {
  code: string;
  displayName: string;
  quantities: {
    main: number;
    departments: Record<string, number>;
  };
  anomalies: string[];
}

export interface ParsedDay {
  dayOfWeek: 1 | 2 | 3 | 4 | 5;
  dayName: string;
  options: ParsedOption[];
  totalUnits: number;
}

export interface ParsedWeek {
  weekLabel: string;
  sheetName: string;
  days: ParsedDay[];
}

export interface ParseResult {
  weeks: ParsedWeek[];
  errors: string[];
  warnings: string[];
}

export interface ValidatedOrderData {
  weekLabel: string;
  days: ValidatedDay[];
  totalUnits: number;
  anomalies: string[];
}

export interface ValidatedDay {
  dayOfWeek: 1 | 2 | 3 | 4 | 5;
  dayName: string;
  options: ValidatedOption[];
  totalUnits: number;
}

export interface ValidatedOption {
  code: string;
  displayName: string;
  mainQuantity: number;
  departments: Record<string, number>;
  isValid: boolean;
  validationNotes: string[];
}

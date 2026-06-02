export interface Accident {
  id: number;
  referenceCode: string;
  title: string;
  severity: string;
  location: string;
  status: string;
  isActive: boolean;
  createdBy: string;
  createdDate: string;
  modifiedBy: string;
  modifiedDate: string;
}

export interface AccidentInput {
  title: string;
  severity: string;
  location: string;
  status: string;
}

export interface PagedResult<T> {
  result: T[];
  pageIndex: number;
  pageSize: number;
  totalRecords: number;
}

export const SEVERITY_OPTIONS = ['Low', 'Medium', 'High', 'Critical'];
export const STATUS_OPTIONS = ['Open', 'Investigating', 'Resolved', 'Closed'];

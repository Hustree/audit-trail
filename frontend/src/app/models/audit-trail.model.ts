export interface AuditTrail {
  id: number;
  tableName: string;
  referenceCode: string;
  oldData: string;
  newData: string;
  actionType: string;
  module: string;
  createdBy: string;
  createdDate: string;
}

export interface AuditTrailFilter {
  actionType?: string;
  module?: string;
  createdBy?: string;
  createdDate?: string;
  pageIndex?: number;
  pageSize?: number;
}

export const ACTION_TYPE_OPTIONS = ['All', 'Insert', 'Update', 'Delete', 'Restore'];

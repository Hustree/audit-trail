import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuditTrail, AuditTrailFilter } from '../models/audit-trail.model';
import { PagedResult } from '../models/accident.model';

@Injectable({ providedIn: 'root' })
export class AuditTrailService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiBaseUrl}/audit-trail`;

  list(filter: AuditTrailFilter): Observable<PagedResult<AuditTrail>> {
    let params = new HttpParams();
    if (filter.actionType && filter.actionType !== 'All') {
      params = params.set('actionType', filter.actionType);
    }
    if (filter.module) params = params.set('module', filter.module);
    if (filter.createdBy) params = params.set('createdBy', filter.createdBy);
    if (filter.createdDate) params = params.set('createdDate', filter.createdDate);
    params = params.set('pageIndex', filter.pageIndex ?? 1);
    params = params.set('pageSize', filter.pageSize ?? 50);
    return this.http.get<PagedResult<AuditTrail>>(this.baseUrl, { params });
  }

  restore(id: number): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/${id}/restore`, {});
  }
}

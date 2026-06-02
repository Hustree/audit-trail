import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Accident, AccidentInput, PagedResult } from '../models/accident.model';

@Injectable({ providedIn: 'root' })
export class AccidentService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiBaseUrl}/accidents`;

  list(pageIndex = 1, pageSize = 50): Observable<PagedResult<Accident>> {
    const params = new HttpParams()
      .set('pageIndex', pageIndex)
      .set('pageSize', pageSize);
    return this.http.get<PagedResult<Accident>>(this.baseUrl, { params });
  }

  create(input: AccidentInput): Observable<Accident> {
    return this.http.post<Accident>(this.baseUrl, input);
  }

  update(id: number, input: AccidentInput): Observable<Accident> {
    return this.http.put<Accident>(`${this.baseUrl}/${id}`, input);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}

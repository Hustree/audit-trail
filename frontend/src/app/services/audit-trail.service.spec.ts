import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';

import { AuditTrailService } from './audit-trail.service';
import { environment } from '../../environments/environment';
import { AuditTrail, AuditTrailFilter } from '../models/audit-trail.model';
import { PagedResult } from '../models/accident.model';

describe('AuditTrailService', () => {
  let service: AuditTrailService;
  let httpMock: HttpTestingController;
  const base = `${environment.apiBaseUrl}/audit-trail`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        AuditTrailService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(AuditTrailService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('list() GETs /audit-trail and builds the expected query from the filter', () => {
    const filter: AuditTrailFilter = {
      actionType: 'Delete',
      module: 'Accident',
      createdBy: 'alice',
      createdDate: '2026-06-01',
      pageIndex: 3,
      pageSize: 25,
    };
    const fake: PagedResult<AuditTrail> = {
      result: [],
      pageIndex: 3,
      pageSize: 25,
      totalRecords: 0,
    };

    let received: PagedResult<AuditTrail> | undefined;
    service.list(filter).subscribe((r) => (received = r));

    const req = httpMock.expectOne(
      (r) => r.method === 'GET' && r.url === base,
    );
    const params = req.request.params;
    expect(params.get('actionType')).toBe('Delete');
    expect(params.get('module')).toBe('Accident');
    expect(params.get('createdBy')).toBe('alice');
    expect(params.get('createdDate')).toBe('2026-06-01');
    expect(params.get('pageIndex')).toBe('3');
    expect(params.get('pageSize')).toBe('25');
    req.flush(fake);

    expect(received).toEqual(fake);
  });

  it('list() omits the actionType param when it is "All"', () => {
    const filter: AuditTrailFilter = {
      actionType: 'All',
      module: '',
      createdBy: '',
      createdDate: '',
    };

    service.list(filter).subscribe();

    const req = httpMock.expectOne(
      (r) => r.method === 'GET' && r.url === base,
    );
    const params = req.request.params;
    expect(params.has('actionType')).toBe(false);
    expect(params.has('module')).toBe(false);
    // Paging defaults are always applied.
    expect(params.get('pageIndex')).toBe('1');
    expect(params.get('pageSize')).toBe('50');
    req.flush({ result: [], pageIndex: 1, pageSize: 50, totalRecords: 0 });
  });

  it('restore() POSTs to /audit-trail/{id}/restore', () => {
    let completed = false;
    service.restore(15).subscribe(() => (completed = true));

    const req = httpMock.expectOne(`${base}/15/restore`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});
    req.flush(null);

    expect(completed).toBe(true);
  });
});

import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';

import { AccidentService } from './accident.service';
import { environment } from '../../environments/environment';
import { Accident, AccidentInput, PagedResult } from '../models/accident.model';

describe('AccidentService', () => {
  let service: AccidentService;
  let httpMock: HttpTestingController;
  const base = `${environment.apiBaseUrl}/accidents`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        AccidentService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(AccidentService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('list() issues GET to /accidents with paging params', () => {
    const fake: PagedResult<Accident> = {
      result: [],
      pageIndex: 2,
      pageSize: 10,
      totalRecords: 0,
    };

    let received: PagedResult<Accident> | undefined;
    service.list(2, 10).subscribe((r) => (received = r));

    const req = httpMock.expectOne(
      (r) => r.method === 'GET' && r.url === base,
    );
    expect(req.request.params.get('pageIndex')).toBe('2');
    expect(req.request.params.get('pageSize')).toBe('10');
    req.flush(fake);

    expect(received).toEqual(fake);
  });

  it('create() issues POST to /accidents with the input body', () => {
    const input: AccidentInput = {
      title: 'Collision',
      severity: 'High',
      location: 'Site A',
      status: 'Open',
    };
    const created = { id: 7, referenceCode: 'ACC-7' } as Accident;

    let received: Accident | undefined;
    service.create(input).subscribe((r) => (received = r));

    const req = httpMock.expectOne(base);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(input);
    req.flush(created);

    expect(received).toEqual(created);
  });

  it('update() issues PUT to /accidents/{id} with the input body', () => {
    const input: AccidentInput = {
      title: 'Updated',
      severity: 'Critical',
      location: 'Site B',
      status: 'Investigating',
    };
    const updated = { id: 42 } as Accident;

    let received: Accident | undefined;
    service.update(42, input).subscribe((r) => (received = r));

    const req = httpMock.expectOne(`${base}/42`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(input);
    req.flush(updated);

    expect(received).toEqual(updated);
  });

  it('delete() issues DELETE to /accidents/{id}', () => {
    let completed = false;
    service.delete(99).subscribe(() => (completed = true));

    const req = httpMock.expectOne(`${base}/99`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);

    expect(completed).toBe(true);
  });
});

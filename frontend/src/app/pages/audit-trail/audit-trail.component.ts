import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { saveAs } from 'file-saver';
import { AuditTrailService } from '../../services/audit-trail.service';
import { AuditTrail } from '../../models/audit-trail.model';
import { IconComponent } from '../../shared/icon.component';
import { DiffViewerComponent } from '../../shared/diff-viewer.component';
import { TweaksService } from '../../shared/tweaks.service';
import { ToastService } from '../../shared/toast.service';
import { ConfirmService } from '../../shared/confirm.service';
import {
  STATUS_TAG,
  changedFields,
  dayLabel,
  fmtDate,
  leftClass,
  nodeClass,
  parseSnapshot,
  relTime,
  timeOfDay,
} from '../../shared/diff.util';

type ViewMode = 'detailed' | 'compact' | 'timeline';

interface AuditVM {
  id: number;
  tableName: string;
  module: string;
  referenceCode: string;
  actionType: string;
  createdBy: string;
  createdAt: string;
  oldObj: Record<string, unknown> | null;
  newObj: Record<string, unknown> | null;
  tags: { key: string; cls: string }[];
  left: string;
  node: string;
  rel: string;
  full: string;
  time: string;
  restorable: boolean;
}

interface FilterState {
  action: string;
  module: string;
  by: string;
  date: string;
  q: string;
}

const EMPTY_FILTER: FilterState = { action: 'All', module: 'All', by: '', date: '', q: '' };

@Component({
  selector: 'app-audit-trail',
  standalone: true,
  imports: [FormsModule, IconComponent, DiffViewerComponent],
  templateUrl: './audit-trail.component.html',
})
export class AuditTrailComponent {
  private service = inject(AuditTrailService);
  private toasts = inject(ToastService);
  private confirm = inject(ConfirmService);
  tweaks = inject(TweaksService);

  readonly actionOptions = ['Insert', 'Update', 'Delete', 'Restore'];

  loading = signal(true);
  error = signal<string | null>(null);
  filtersOpen = signal(true);
  view = signal<ViewMode>('detailed');
  flashId = signal<number | null>(null);
  openRows = signal<Set<number>>(new Set());

  private entries = signal<AuditVM[]>([]);
  filter = signal<FilterState>({ ...EMPTY_FILTER });

  /** Module options derived from the loaded data. */
  moduleOptions = computed(() => {
    const set = new Set<string>();
    this.entries().forEach((e) => e.module && set.add(e.module));
    return [...set].sort();
  });

  activeCount = computed(() => {
    const f = this.filter();
    return (
      ['action', 'module'].filter((k) => (f as any)[k] !== 'All').length +
      ['by', 'date', 'q'].filter((k) => (f as any)[k]).length
    );
  });

  rows = computed<AuditVM[]>(() => {
    const f = this.filter();
    return this.entries().filter((e) => {
      if (f.action !== 'All' && e.actionType !== f.action) return false;
      if (f.module !== 'All' && e.module !== f.module) return false;
      if (f.by && !e.createdBy.toLowerCase().includes(f.by.toLowerCase())) return false;
      if (f.date && new Date(e.createdAt).toISOString().slice(0, 10) !== f.date) return false;
      if (f.q) {
        const hay = (
          e.tableName +
          ' ' +
          e.module +
          ' ' +
          e.createdBy +
          ' ' +
          JSON.stringify(e.oldObj || {}) +
          ' ' +
          JSON.stringify(e.newObj || {})
        ).toLowerCase();
        if (!hay.includes(f.q.toLowerCase())) return false;
      }
      return true;
    });
  });

  timelineGroups = computed(() => {
    const groups: { label: string; items: AuditVM[] }[] = [];
    this.rows().forEach((e) => {
      const lbl = dayLabel(e.createdAt);
      const last = groups[groups.length - 1];
      if (last && last.label === lbl) last.items.push(e);
      else groups.push({ label: lbl, items: [e] });
    });
    return groups;
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.service.list({ pageIndex: 1, pageSize: 200 }).subscribe({
      next: (res) => {
        const rows = (res.result ?? [])
          .slice()
          .sort((a, b) => new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime())
          .map((e) => this.toVM(e));
        this.entries.set(rows);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Failed to load the audit trail. Is the API running on :5080?');
        this.loading.set(false);
      },
    });
  }

  private toVM(e: AuditTrail): AuditVM {
    const oldObj = parseSnapshot(e.oldData);
    const newObj = parseSnapshot(e.newData);
    const tags = changedFields(oldObj, newObj).map((f) => ({
      key: f.key,
      cls: STATUS_TAG[f.status] ?? '',
    }));
    return {
      id: e.id,
      tableName: e.tableName,
      module: e.module,
      referenceCode: e.referenceCode,
      actionType: e.actionType,
      createdBy: e.createdBy,
      createdAt: e.createdDate,
      oldObj,
      newObj,
      tags,
      left: leftClass(e.actionType),
      node: nodeClass(e.actionType),
      rel: relTime(e.createdDate),
      full: fmtDate(e.createdDate),
      time: timeOfDay(e.createdDate),
      restorable: e.actionType === 'Delete',
    };
  }

  /* ── filters ─────────────────────────────────────────────────────────── */
  setField<K extends keyof FilterState>(key: K, value: FilterState[K]): void {
    this.filter.update((s) => ({ ...s, [key]: value }));
  }
  reset(): void {
    this.filter.set({ ...EMPTY_FILTER });
  }
  toggleFilters(): void {
    this.filtersOpen.update((v) => !v);
  }

  /* ── expand/collapse rows in compact/timeline ────────────────────────── */
  toggleRow(id: number): void {
    this.openRows.update((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }
  isOpen(id: number): boolean {
    return this.openRows().has(id);
  }

  tagsShown(vm: AuditVM, max: number) {
    return vm.tags.slice(0, max);
  }
  tagsMore(vm: AuditVM, max: number): number {
    return Math.max(0, vm.tags.length - max);
  }

  /* ── restore ─────────────────────────────────────────────────────────── */
  async restore(vm: AuditVM): Promise<void> {
    const ok = await this.confirm.ask({
      tone: 'brand',
      icon: 'restore',
      title: 'Restore this record?',
      body: `This re-creates "${vm.oldObj?.['Title'] || vm.referenceCode || 'the record'}" as a live entry and logs a new Restore action. History is preserved.`,
      confirmLabel: 'Restore record',
    });
    if (!ok) return;
    this.service.restore(vm.id).subscribe({
      next: () => {
        this.toasts.notify({
          type: 'ok',
          title: 'Record restored',
          msg: `${vm.referenceCode || vm.tableName} is live again, a Restore entry was logged.`,
        });
        this.reloadAndFlash();
      },
      error: (err) => {
        if (err?.status === 409) {
          this.toasts.notify({
            type: 'warn',
            title: 'Could not restore',
            msg: 'A live record with that reference already exists.',
          });
        } else {
          this.toasts.notify({ type: 'warn', title: 'Restore failed', msg: 'Please try again.' });
        }
      },
    });
  }

  private reloadAndFlash(): void {
    this.service.list({ pageIndex: 1, pageSize: 200 }).subscribe({
      next: (res) => {
        const rows = (res.result ?? [])
          .slice()
          .sort((a, b) => new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime())
          .map((e) => this.toVM(e));
        this.entries.set(rows);
        const newest = rows.length ? Math.max(...rows.map((r) => r.id)) : null;
        this.flashId.set(newest);
        setTimeout(() => this.flashId.set(null), 1700);
      },
    });
  }

  /* ── CSV export ──────────────────────────────────────────────────────── */
  exportCsv(): void {
    const rows = this.rows();
    const head = ['id', 'table', 'module', 'action', 'createdBy', 'createdAt', 'old', 'new'];
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [head.join(',')].concat(
      rows.map((e) =>
        [
          e.id,
          e.tableName,
          e.module,
          e.actionType,
          e.createdBy,
          e.createdAt,
          JSON.stringify(e.oldObj || {}),
          JSON.stringify(e.newObj || {}),
        ]
          .map(esc)
          .join(','),
      ),
    );
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, `audit-trail-${new Date().toISOString().slice(0, 10)}.csv`);
    this.toasts.notify({
      type: 'ok',
      title: 'Export complete',
      msg: `${rows.length} entries written to CSV`,
    });
  }
}

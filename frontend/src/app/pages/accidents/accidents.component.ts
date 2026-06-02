import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AccidentService } from '../../services/accident.service';
import {
  Accident,
  AccidentInput,
  SEVERITY_OPTIONS,
  STATUS_OPTIONS,
} from '../../models/accident.model';
import { IconComponent } from '../../shared/icon.component';
import { ToastService } from '../../shared/toast.service';
import { ConfirmService } from '../../shared/confirm.service';
import { relTime } from '../../shared/diff.util';

const STATUS_COLOR: Record<string, string> = {
  Open: 'var(--neg-fg)',
  Investigating: 'var(--warn-fg)',
  Resolved: 'var(--pos-fg)',
  Closed: 'var(--faint)',
};

@Component({
  selector: 'app-accidents',
  standalone: true,
  imports: [FormsModule, IconComponent],
  templateUrl: './accidents.component.html',
})
export class AccidentsComponent {
  private service = inject(AccidentService);
  private toasts = inject(ToastService);
  private confirm = inject(ConfirmService);

  readonly severityOptions = SEVERITY_OPTIONS;
  readonly statusOptions = STATUS_OPTIONS;

  accidents = signal<Accident[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);

  showForm = signal(false);
  editingId = signal<number | null>(null);
  touched = signal(false);
  flashId = signal<number | null>(null);
  form = signal<AccidentInput>(this.emptyForm());

  ngOnInit(): void {
    this.load();
  }

  private emptyForm(): AccidentInput {
    return { title: '', severity: 'Medium', location: '', status: 'Open' };
  }

  titleInvalid(): boolean {
    return this.touched() && !this.form().title.trim();
  }

  setField<K extends keyof AccidentInput>(key: K, value: AccidentInput[K]): void {
    this.form.update((f) => ({ ...f, [key]: value }));
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.service.list().subscribe({
      next: (res) => {
        this.accidents.set(res.result ?? []);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Failed to load incidents. Is the API running on :5080?');
        this.loading.set(false);
      },
    });
  }

  openCreate(): void {
    this.editingId.set(null);
    this.form.set(this.emptyForm());
    this.touched.set(false);
    this.showForm.set(true);
  }

  openEdit(a: Accident): void {
    this.editingId.set(a.id);
    this.form.set({ title: a.title, severity: a.severity, location: a.location, status: a.status });
    this.touched.set(false);
    this.showForm.set(true);
  }

  cancelForm(): void {
    this.showForm.set(false);
    this.editingId.set(null);
    this.form.set(this.emptyForm());
  }

  save(): void {
    this.touched.set(true);
    if (!this.form().title.trim()) return;
    const id = this.editingId();
    const op = id ? this.service.update(id, this.form()) : this.service.create(this.form());
    op.subscribe({
      next: (saved) => {
        this.cancelForm();
        this.flash(saved.id);
        if (id) {
          this.toasts.notify({
            type: 'ok',
            title: 'Incident updated',
            msg: `${saved.referenceCode} saved · change logged to the audit trail`,
          });
        } else {
          this.toasts.notify({
            type: 'ok',
            title: 'Incident logged',
            msg: `${saved.referenceCode} created · Insert recorded in the audit trail`,
          });
        }
        this.load();
      },
      error: () => this.toasts.notify({ type: 'warn', title: 'Save failed', msg: 'Please try again.' }),
    });
  }

  async remove(a: Accident): Promise<void> {
    const ok = await this.confirm.ask({
      tone: 'danger',
      icon: 'trash',
      title: 'Soft-delete this incident?',
      body: `"${a.title}" (${a.referenceCode}) will be removed from the active list. It stays in the audit trail and can be restored.`,
      confirmLabel: 'Delete incident',
    });
    if (!ok) return;
    this.service.delete(a.id).subscribe({
      next: () => {
        this.toasts.notify({
          type: 'warn',
          title: 'Incident soft-deleted',
          msg: `${a.referenceCode} removed · restore it any time from the Audit Trail`,
        });
        this.load();
      },
      error: () => this.toasts.notify({ type: 'warn', title: 'Delete failed', msg: 'Please try again.' }),
    });
  }

  private flash(id: number): void {
    this.flashId.set(id);
    setTimeout(() => this.flashId.set(null), 1700);
  }

  statusColor(status: string): string {
    return STATUS_COLOR[status] ?? 'var(--faint)';
  }

  rel(iso: string): string {
    return iso ? relTime(iso) : '-';
  }
}

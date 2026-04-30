import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService, TranscodeJob, LiveStreamSettings } from '../../services/api.service';

@Component({
  selector: 'app-status-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="animate-in">
      <div class="page-header">
        <h1>Dashboard</h1>
        <p>Monitor your transcoding jobs in real-time</p>
      </div>

      <!-- Stats Cards -->
      <div class="stats-row">
        <div class="stat-card">
          <div class="stat-icon blue">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </div>
          <div class="stat-info">
            <div class="stat-value">{{ completedCount }}</div>
            <div class="stat-label">Completed</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon orange">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
          </div>
          <div class="stat-info">
            <div class="stat-value">{{ inProgressCount }}</div>
            <div class="stat-label">In Progress</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon teal">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="8" y1="6" x2="21" y2="6"></line>
              <line x1="8" y1="12" x2="21" y2="12"></line>
              <line x1="8" y1="18" x2="21" y2="18"></line>
              <line x1="3" y1="6" x2="3.01" y2="6"></line>
              <line x1="3" y1="12" x2="3.01" y2="12"></line>
              <line x1="3" y1="18" x2="3.01" y2="18"></line>
            </svg>
          </div>
          <div class="stat-info">
            <div class="stat-value">{{ queuedCount }}</div>
            <div class="stat-label">Queued</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon red">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="15" y1="9" x2="9" y2="15"></line>
              <line x1="9" y1="9" x2="15" y2="15"></line>
            </svg>
          </div>
          <div class="stat-info">
            <div class="stat-value">{{ failedCount }}</div>
            <div class="stat-label">Failed</div>
          </div>
        </div>
      </div>

      <!-- Jobs Table -->
      <div class="table-card card" *ngIf="jobs.length > 0">
        <table class="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>File Name</th>
              <th>Qualities</th>
              <th>Format</th>
              <th>Status</th>
              <th>Progress</th>
              <th>Time Stamp</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let job of jobs">
              <td class="cell-id">{{ job.id }}</td>
              <td class="cell-file">{{ job.inputFileName }}</td>
              <td>
                <div style="display: flex; flex-direction: column; gap: 4px; align-items: flex-start;">
                  <span class="badge badge-info" *ngFor="let pName of (job.presetNames || '').split(', ')">{{ pName }}</span>
                </div>
              </td>
              <td><span class="badge" style="background-color: var(--secondary); color: white;">{{ job.outputFormat }}</span></td>
              <td>
                <span class="badge" [ngClass]="getStatusBadgeClass(job.status)">
                  {{ formatStatus(job.status) }}
                </span>
              </td>
              <td class="cell-progress">
                <div class="progress-wrap">
                  <div class="progress-track">
                    <div class="progress-fill"
                         [style.width.%]="job.progress"
                         [ngClass]="getProgressClass(job.status)">
                    </div>
                  </div>
                  <span class="progress-pct">{{ job.progress }}%</span>
                </div>
              </td>
              <td class="cell-date">{{ formatDate(job.createdAt) }}</td>
              <td>
                <div class="action-buttons">
                  <button *ngIf="job.status === 'QUEUED' || job.status === 'IN_PROGRESS'"
                          (click)="cancelJob(job.id)"
                          class="btn btn-danger btn-sm">
                    Cancel
                  </button>
                  <button *ngIf="job.inputFileName === 'LIVE_STREAM' && (job.status === 'IN_PROGRESS' || job.status === 'COMPLETED')"
                          (click)="openEditModal(job)"
                          class="btn btn-edit btn-sm">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                    Edit
                  </button>
                  <a *ngIf="(job.status === 'COMPLETED' && job.inputFileName !== 'LIVE_STREAM') || (job.status === 'IN_PROGRESS' && job.inputFileName === 'LIVE_STREAM')"
                     [routerLink]="['/player', job.id]"
                     class="btn btn-primary btn-sm">
                    Watch
                  </a>
                  <span *ngIf="job.status === 'COMPLETED' && job.inputFileName === 'LIVE_STREAM'" class="text-muted">Ended</span>
                  <span *ngIf="job.status === 'IN_PROGRESS' && job.inputFileName !== 'LIVE_STREAM'" class="status-dot pulse"></span>
                  <span *ngIf="job.status === 'FAILED' || job.status === 'CANCELLED'" class="text-danger">-</span>
                  <span *ngIf="job.status === 'QUEUED'" class="text-muted">-</span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="empty-card card" *ngIf="jobs.length === 0 && !loading">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <line x1="8" y1="6" x2="21" y2="6"></line>
          <line x1="8" y1="12" x2="21" y2="12"></line>
          <line x1="8" y1="18" x2="21" y2="18"></line>
          <line x1="3" y1="6" x2="3.01" y2="6"></line>
          <line x1="3" y1="12" x2="3.01" y2="12"></line>
          <line x1="3" y1="18" x2="3.01" y2="18"></line>
        </svg>
        <h3>No jobs yet</h3>
        <p>Start a transcode job from the <a routerLink="/transcode">Transcode</a> page</p>
      </div>

      <!-- Edit Recording Settings Modal -->
      <div class="modal-overlay" *ngIf="editModalVisible" (click)="closeEditModal()">
        <div class="modal-content animate-modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.83l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
              </svg>
              Recording Settings
            </h3>
            <button class="modal-close" (click)="closeEditModal()">&times;</button>
          </div>

          <div class="modal-body" *ngIf="editSettings">
            <div class="setting-group">
              <label>Segment Duration</label>
              <p class="setting-hint">How long each recording chunk will be</p>
              <select [(ngModel)]="editSettings.chunkDurationMinutes" class="setting-select">
                <option [ngValue]="1">1 minute (test)</option>
                <option [ngValue]="5">5 minutes</option>
                <option [ngValue]="10">10 minutes</option>
                <option [ngValue]="15">15 minutes</option>
                <option [ngValue]="30">30 minutes</option>
                <option [ngValue]="60">1 hour</option>
                <option [ngValue]="120">2 hours</option>
              </select>
            </div>

            <div class="setting-group">
              <label>Retention Period</label>
              <p class="setting-hint">How long recordings will be kept before auto-deletion</p>
              <select [(ngModel)]="editSettings.retentionPeriodHours" class="setting-select">
                <option [ngValue]="1">1 hour</option>
                <option [ngValue]="6">6 hours</option>
                <option [ngValue]="24">1 day</option>
                <option [ngValue]="72">3 days</option>
                <option [ngValue]="168">7 days</option>
                <option [ngValue]="720">30 days</option>
              </select>
            </div>
          </div>

          <div class="modal-footer">
            <button class="btn btn-secondary btn-sm" (click)="closeEditModal()">Cancel</button>
            <button class="btn btn-primary btn-sm" (click)="saveSettings()" [disabled]="savingSettings">
              {{ savingSettings ? 'Saving...' : 'Save Changes' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .table-card { padding: 0; overflow: hidden; }

    .data-table {
      width: 100%;
      border-collapse: collapse;

      th, td {
        padding: 0.75rem 1.25rem;
        text-align: left;
        white-space: nowrap;
        font-size: 0.88rem;
      }

      thead th {
        font-size: 0.75rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--text-secondary);
        background: #f8fafc;
        border-bottom: 1px solid var(--border);
      }

      tbody tr {
        border-bottom: 1px solid #f1f5f9;
        transition: background 0.15s;

        &:hover { background: #f8fafc; }
        &:last-child { border-bottom: none; }
      }
    }

    .cell-id {
      font-weight: 600;
      color: var(--text-secondary);
    }

    .cell-file { font-weight: 500; }

    .cell-date {
      color: var(--text-secondary);
      font-size: 0.82rem;
    }

    .cell-progress { min-width: 160px; }

    .progress-wrap {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .progress-track {
      flex: 1;
      height: 7px;
      background: #e2e8f0;
      border-radius: 4px;
      overflow: hidden;
    }

    .progress-fill {
      height: 100%;
      border-radius: 4px;
      transition: width 0.4s ease;

      &.completed { background: var(--success); }
      &.in-progress { background: var(--primary); }
      &.failed { background: var(--danger); }
      &.queued { background: var(--text-muted); }
    }

    .progress-pct {
      font-size: 0.78rem;
      font-weight: 600;
      color: var(--text-secondary);
      min-width: 2.5rem;
      text-align: right;
    }

    .action-buttons {
      display: flex;
      align-items: center;
      gap: 0.4rem;
    }

    .btn-edit {
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
      background: linear-gradient(135deg, #667eea, #764ba2);
      color: white;
      border: none;
      border-radius: 6px;
      padding: 0.35rem 0.75rem;
      font-size: 0.78rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;

      &:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
      }
    }

    .status-dot {
      display: inline-block;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--primary);

      &.pulse {
        animation: pulse 1.5s ease-in-out infinite;
      }
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }

    .text-danger { color: var(--danger); font-size: 0.85rem; }
    .text-muted { color: var(--text-muted); font-size: 0.85rem; }

    .empty-card {
      text-align: center;
      padding: 3rem 1rem;
      color: var(--text-muted);

      svg { margin-bottom: 0.75rem; opacity: 0.4; }
      h3 { color: var(--text-secondary); margin-bottom: 0.25rem; font-size: 1rem; }
      p { font-size: 0.88rem; }
      a { color: var(--primary); text-decoration: none; &:hover { text-decoration: underline; } }
    }

    /* Modal Styles */
    .modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.5);
      backdrop-filter: blur(4px);
      z-index: 1000;
      display: flex;
      align-items: center;
      justify-content: center;
      animation: fadeIn 0.2s ease;
    }

    .modal-content {
      background: white;
      border-radius: 16px;
      width: 440px;
      max-width: 90vw;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25);
      overflow: hidden;
    }

    .animate-modal {
      animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    @keyframes slideUp {
      from { opacity: 0; transform: translateY(20px) scale(0.97); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1.25rem 1.5rem;
      border-bottom: 1px solid var(--border);

      h3 {
        margin: 0;
        font-size: 1.05rem;
        font-weight: 700;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        color: var(--text-primary);
      }
    }

    .modal-close {
      background: none;
      border: none;
      font-size: 1.5rem;
      color: var(--text-muted);
      cursor: pointer;
      padding: 0 0.25rem;
      line-height: 1;
      transition: color 0.15s;

      &:hover { color: var(--text-primary); }
    }

    .modal-body {
      padding: 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .setting-group {
      label {
        display: block;
        font-size: 0.88rem;
        font-weight: 600;
        color: var(--text-primary);
        margin-bottom: 0.2rem;
      }
    }

    .setting-hint {
      font-size: 0.75rem;
      color: var(--text-muted);
      margin: 0 0 0.5rem 0;
    }

    .setting-select {
      width: 100%;
      padding: 0.65rem 0.85rem;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: var(--bg-page, #f8fafc);
      color: var(--text-primary);
      font-size: 0.88rem;
      cursor: pointer;
      transition: border-color 0.2s;

      &:focus {
        outline: none;
        border-color: var(--primary);
        box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
      }
    }

    .modal-footer {
      display: flex;
      justify-content: flex-end;
      gap: 0.75rem;
      padding: 1rem 1.5rem;
      border-top: 1px solid var(--border);
      background: #f8fafc;
    }
  `]
})
export class StatusPageComponent implements OnInit, OnDestroy {
  jobs: TranscodeJob[] = [];
  loading = true;
  private refreshInterval: any;

  // Edit modal state
  editModalVisible = false;
  editJobId: number | null = null;
  editSettings: LiveStreamSettings | null = null;
  savingSettings = false;

  constructor(private api: ApiService) { }

  ngOnInit() {
    this.loadJobs();
    this.refreshInterval = setInterval(() => this.loadJobs(), 5000);
  }

  ngOnDestroy() {
    if (this.refreshInterval) clearInterval(this.refreshInterval);
  }

  get completedCount(): number { return this.jobs.filter(j => j.status === 'COMPLETED').length; }
  get inProgressCount(): number { return this.jobs.filter(j => j.status === 'IN_PROGRESS').length; }
  get queuedCount(): number { return this.jobs.filter(j => j.status === 'QUEUED').length; }
  get failedCount(): number { return this.jobs.filter(j => j.status === 'FAILED').length; }

  loadJobs() {
    this.api.getJobs().subscribe({
      next: (jobs) => {
        this.jobs = jobs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        this.loading = false;
      },
      error: () => this.loading = false
    });
  }

  getStatusBadgeClass(status: string): string {
    const map: Record<string, string> = {
      'COMPLETED': 'badge-success', 'IN_PROGRESS': 'badge-warning',
      'FAILED': 'badge-danger', 'QUEUED': 'badge-info', 'CANCELLED': 'badge-danger'
    };
    return map[status] || '';
  }

  getProgressClass(status: string): string {
    const map: Record<string, string> = {
      'COMPLETED': 'completed', 'IN_PROGRESS': 'in-progress',
      'FAILED': 'failed', 'QUEUED': 'queued', 'CANCELLED': 'failed'
    };
    return map[status] || '';
  }

  formatStatus(status: string): string {
    return status.replace('_', ' ');
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    const day = d.getDate().toString().padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const mon = months[d.getMonth()];
    const year = d.getFullYear();
    const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }).toLowerCase();
    return `${day}-${mon}-${year} | ${time}`;
  }

  cancelJob(id: number) {
    if (confirm('Are you sure you want to cancel this job?')) {
      this.api.cancelJob(id).subscribe({
        next: () => this.loadJobs(),
        error: (err) => alert('Failed to cancel job')
      });
    }
  }

  // --- Edit Modal ---
  openEditModal(job: TranscodeJob) {
    this.editJobId = job.id;
    this.editModalVisible = true;
    this.editSettings = null;

    this.api.getRecordingSettings(job.id).subscribe({
      next: (settings) => this.editSettings = { ...settings },
      error: () => {
        this.editSettings = { jobId: job.id, chunkDurationMinutes: 30, retentionPeriodHours: 168 };
      }
    });
  }

  closeEditModal() {
    this.editModalVisible = false;
    this.editJobId = null;
    this.editSettings = null;
  }

  saveSettings() {
    if (!this.editSettings || !this.editJobId) return;
    this.savingSettings = true;

    this.api.updateRecordingSettings(this.editJobId, {
      chunkDurationMinutes: this.editSettings.chunkDurationMinutes,
      retentionPeriodHours: this.editSettings.retentionPeriodHours
    }).subscribe({
      next: () => {
        this.savingSettings = false;
        this.closeEditModal();
      },
      error: () => {
        this.savingSettings = false;
        alert('Failed to save settings');
      }
    });
  }
}

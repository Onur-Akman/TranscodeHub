import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService, TranscodeJob } from '../../services/api.service';

@Component({
    selector: 'app-status-page',
    standalone: true,
    imports: [CommonModule, RouterLink],
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
              <th>Preset</th>
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
              <td><span class="badge badge-info">{{ job.presetName }}</span></td>
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
                <a *ngIf="job.status === 'COMPLETED'"
                   [routerLink]="['/player', job.id]"
                   class="btn btn-primary btn-sm">
                  Watch
                </a>
                <span *ngIf="job.status === 'IN_PROGRESS'" class="status-dot pulse"></span>
                <span *ngIf="job.status === 'FAILED'" class="text-danger">-</span>
                <span *ngIf="job.status === 'QUEUED'" class="text-muted">-</span>
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
  `]
})
export class StatusPageComponent implements OnInit, OnDestroy {
    jobs: TranscodeJob[] = [];
    loading = true;
    private eventSources: EventSource[] = [];
    private refreshInterval: any;

    constructor(private api: ApiService) { }

    ngOnInit() {
        this.loadJobs();
        this.refreshInterval = setInterval(() => this.loadJobs(), 5000);
    }

    ngOnDestroy() {
        this.closeAllEventSources();
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
                this.subscribeToActiveJobs();
            },
            error: () => this.loading = false
        });
    }

    private subscribeToActiveJobs() {
        this.closeAllEventSources();
        const active = this.jobs.filter(j => j.status === 'IN_PROGRESS' || j.status === 'QUEUED');
        for (const job of active) {
            const es = this.api.streamProgress(job.id);
            es.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    const idx = this.jobs.findIndex(j => j.id === job.id);
                    if (idx >= 0) {
                        this.jobs[idx].progress = data.progress;
                        this.jobs[idx].status = data.status;
                        if (data.status === 'COMPLETED' || data.status === 'FAILED') es.close();
                    }
                } catch (e) { }
            };
            es.onerror = () => es.close();
            this.eventSources.push(es);
        }
    }

    private closeAllEventSources() {
        this.eventSources.forEach(es => es.close());
        this.eventSources = [];
    }

    getStatusBadgeClass(status: string): string {
        const map: Record<string, string> = {
            'COMPLETED': 'badge-success', 'IN_PROGRESS': 'badge-warning',
            'FAILED': 'badge-danger', 'QUEUED': 'badge-info'
        };
        return map[status] || '';
    }

    getProgressClass(status: string): string {
        const map: Record<string, string> = {
            'COMPLETED': 'completed', 'IN_PROGRESS': 'in-progress',
            'FAILED': 'failed', 'QUEUED': 'queued'
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
        const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        const mon = months[d.getMonth()];
        const year = d.getFullYear();
        const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }).toLowerCase();
        return `${day}-${mon}-${year} | ${time}`;
    }
}

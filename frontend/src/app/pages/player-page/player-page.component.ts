import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService, TranscodeJob } from '../../services/api.service';

@Component({
    selector: 'app-player-page',
    standalone: true,
    imports: [CommonModule, RouterLink],
    template: `
    <div class="animate-in">
      <div class="page-header">
        <a routerLink="/status" class="back-link">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
          Back to Dashboard
        </a>
        <h1 *ngIf="job">{{ job.inputFileName }}</h1>
        <p *ngIf="job">Transcoded with {{ job.presetName }}</p>
      </div>

      <div class="player-section" *ngIf="job && job.status === 'COMPLETED'">
        <div class="video-wrapper card">
          <video controls autoplay [src]="getVideoUrl()" (error)="onVideoError()" preload="metadata">
            Your browser does not support the video tag.
          </video>
        </div>

        <div class="card info-card">
          <h3>Video Details</h3>
          <div class="info-grid">
            <div class="info-item"><span class="label">Input</span><span>{{ job.inputFileName }}</span></div>
            <div class="info-item"><span class="label">Output</span><span>{{ job.outputFileName }}</span></div>
            <div class="info-item"><span class="label">Preset</span><span class="badge badge-info">{{ job.presetName }}</span></div>
            <div class="info-item"><span class="label">Status</span><span class="badge badge-success">COMPLETED</span></div>
            <div class="info-item" *ngIf="job.createdAt"><span class="label">Started</span><span>{{ formatDate(job.createdAt) }}</span></div>
            <div class="info-item" *ngIf="job.completedAt"><span class="label">Finished</span><span>{{ formatDate(job.completedAt) }}</span></div>
          </div>
          <div class="actions">
            <a [href]="getVideoUrl()" download class="btn btn-secondary">Download Video</a>
          </div>
        </div>
      </div>

      <div class="card empty-card" *ngIf="job && job.status !== 'COMPLETED'">
        <h3>Video not ready</h3>
        <p>This job is <strong>{{ job.status }}</strong>. Wait for completion.</p>
        <a routerLink="/status" class="btn btn-primary" style="margin-top: 1rem">Go to Dashboard</a>
      </div>

      <div class="card empty-card" *ngIf="videoError">
        <h3>Failed to load video</h3>
        <p>The video file could not be loaded.</p>
      </div>

      <div class="card empty-card" *ngIf="!loading && !job">
        <h3>Job not found</h3>
        <a routerLink="/status" class="btn btn-primary" style="margin-top: 1rem">Go to Dashboard</a>
      </div>
    </div>
  `,
    styles: [`
    .back-link {
      display: inline-flex; align-items: center; gap: 0.4rem;
      color: var(--text-secondary); text-decoration: none; font-size: 0.85rem;
      font-weight: 500; margin-bottom: 0.5rem;
      &:hover { color: var(--primary); }
    }

    .player-section { display: flex; flex-direction: column; gap: 1.25rem; }

    .video-wrapper {
      padding: 0; overflow: hidden; background: #000;
      video { width: 100%; max-height: 65vh; display: block; }
    }

    .info-card {
      h3 {
        font-size: 0.95rem; font-weight: 600; margin-bottom: 1rem;
        padding-bottom: 0.65rem; border-bottom: 1px solid var(--border);
      }
    }

    .info-grid {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 0.65rem;
    }

    .info-item {
      display: flex; flex-direction: column; gap: 0.15rem;
      .label { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); font-weight: 600; }
      span:not(.label):not(.badge) { font-size: 0.88rem; font-weight: 500; }
    }

    .actions { margin-top: 1rem; padding-top: 0.75rem; border-top: 1px solid var(--border); }

    .empty-card {
      text-align: center; padding: 3rem 1rem;
      h3 { color: var(--text-secondary); margin-bottom: 0.25rem; }
      p { color: var(--text-muted); font-size: 0.88rem; }
      strong { color: var(--warning); }
    }
  `]
})
export class PlayerPageComponent implements OnInit {
    job: TranscodeJob | null = null;
    loading = true;
    videoError = false;

    constructor(private route: ActivatedRoute, private api: ApiService) { }

    ngOnInit() {
        const id = Number(this.route.snapshot.paramMap.get('jobId'));
        if (id) {
            this.api.getJob(id).subscribe({ next: (j) => { this.job = j; this.loading = false; }, error: () => this.loading = false });
        } else { this.loading = false; }
    }

    getVideoUrl(): string { return this.job?.outputFileName ? `/videos/output/${this.job.outputFileName}` : ''; }
    onVideoError() { this.videoError = true; }

    formatDate(d: string | null): string {
        if (!d) return '-';
        return new Date(d).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    }
}

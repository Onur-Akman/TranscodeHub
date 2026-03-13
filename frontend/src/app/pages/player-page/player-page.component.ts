import { Component, OnInit, ElementRef, ViewChild, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService, TranscodeJob, LiveStreamSegment } from '../../services/api.service';
import Hls from 'hls.js';
import * as shakaExport from 'shaka-player';
const shaka: any = shakaExport;

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
        <p *ngIf="job">Transcoded Qualities: {{ job.presetNames }} ({{ job.outputFormat }})</p>
      </div>

      <div class="player-section" *ngIf="job && (job.status === 'COMPLETED' || (job.status === 'IN_PROGRESS' && job.inputFileName === 'LIVE_STREAM'))">
        <div class="video-wrapper card">
          <video #videoPlayer controls autoplay [src]="nativeVideoUrl" 
                 [class.live-stream]="job?.inputFileName === 'LIVE_STREAM' && !playingSegment"
                 (error)="onVideoError()" preload="metadata">
            Your browser does not support the video tag.
          </video>
          
          <div class="quality-overlay" *ngIf="qualities.length > 0">
            <button class="gear-btn" (click)="toggleQualityMenu()" title="Settings">
              <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
                <path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.06-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.73,8.87 C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.06,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.49-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z" />
              </svg>
            </button>
            <div class="quality-menu" *ngIf="showQualityMenu">
              <div class="menu-header">Quality</div>
              <ul class="quality-list">
                <li [class.active]="selectedQuality === -1" (click)="onQualitySelect(-1)">
                  <span class="check" *ngIf="selectedQuality === -1">✓</span> Auto
                </li>
                <li *ngFor="let q of qualities" [class.active]="selectedQuality === q.id" (click)="onQualitySelect(q.id)">
                  <span class="check" *ngIf="selectedQuality === q.id">✓</span> {{ q.label }}
                </li>
              </ul>
            </div>
          </div>

          <!-- Back to Live overlay -->
          <button class="back-to-live-btn" *ngIf="playingSegment" (click)="backToLive()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
              <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
            Back to Live
          </button>
        </div>

        <!-- Segment Timeline (for live streams) -->
        <div class="segment-timeline card" *ngIf="isLiveStream && segments.length > 0">
          <div class="timeline-header">
            <h3>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
              Recording History
            </h3>
            <span class="segment-count">{{ segments.length }} segments</span>
          </div>
          <div class="timeline-scroll">
            <div class="timeline-grid">
              <div class="segment-card"
                   *ngFor="let seg of segments; let i = index"
                   [class.active]="playingSegmentId === seg.id"
                   (click)="playSegment(seg)">
                <div class="segment-day">{{ getDayName(seg.startTime) }}</div>
                <div class="segment-bottom">
                  <div class="segment-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="24" height="24" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
                      <path d="M3 3v5h5"></path>
                      <polygon points="10 9 15 12 10 15 10 9" fill="currentColor" stroke="none"></polygon>
                    </svg>
                  </div>
                  <div class="segment-time">{{ formatSegmentTime(seg.startTime) }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="card info-card">
          <div class="info-header">
            <h3>Video Details</h3>
          </div>
          <div class="info-grid">
            <div class="info-item"><span class="label">Input</span><span>{{ job.inputFileName }}</span></div>
            <div class="info-item"><span class="label">Output</span><span>{{ job.outputFileName }}</span></div>
            <div class="info-item"><span class="label">Presets</span><span class="badge badge-info">{{ job.presetNames }}</span></div>
            <div class="info-item"><span class="label">Format</span><span class="badge" style="background-color: var(--secondary); color: white;">{{ job.outputFormat }}</span></div>
            <div class="info-item"><span class="label">Status</span><span class="badge" [ngClass]="{'badge-success': job.status === 'COMPLETED', 'badge-warning': job.status === 'IN_PROGRESS'}">{{ job.status }}</span></div>
            <div class="info-item" *ngIf="job.createdAt"><span class="label">Started</span><span>{{ formatDate(job.createdAt) }}</span></div>
            <div class="info-item" *ngIf="job.completedAt"><span class="label">Finished</span><span>{{ formatDate(job.completedAt) }}</span></div>
          </div>
          <div class="actions" *ngIf="job.outputFormat === 'MP4'">
            <a [href]="getVideoUrl()" download class="btn btn-secondary">Download Video</a>
          </div>
        </div>
      </div>

      <div class="card empty-card" *ngIf="job && !(job.status === 'COMPLETED' || (job.status === 'IN_PROGRESS' && job.inputFileName === 'LIVE_STREAM'))">
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
      padding: 0; overflow: hidden; background: #000; position: relative;
      video { width: 100%; max-height: 65vh; display: block; }
      video.live-stream::-webkit-media-controls-time-remaining-display { display: none !important; }
      
      .quality-overlay {
        position: absolute; right: 20px; top: 20px; z-index: 100;
      }
      .gear-btn {
        background: rgba(0, 0, 0, 0.6); color: white; border: none; border-radius: 50%; width: 40px; height: 40px;
        display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s;
        backdrop-filter: blur(4px);
        &:hover { background: rgba(0, 0, 0, 0.8); transform: scale(1.05); }
      }
      .quality-menu {
        position: absolute; right: 0; top: 48px; background: rgba(28, 28, 28, 0.95); color: white; border-radius: 8px;
        min-width: 140px; box-shadow: 0 8px 24px rgba(0,0,0,0.5); backdrop-filter: blur(8px); overflow: hidden;
        animation: slideDown 0.2s ease-out; transform-origin: top right;
        .menu-header { padding: 10px 16px; font-weight: 600; font-size: 0.85rem; border-bottom: 1px solid rgba(255,255,255,0.1); color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; }
        .quality-list {
          list-style: none; padding: 6px 0; margin: 0; max-height: 250px; overflow-y: auto;
          li {
            padding: 8px 16px 8px 36px; cursor: pointer; font-size: 0.9rem; transition: background 0.15s; position: relative;
            &:hover { background: rgba(255,255,255,0.1); }
            &.active { font-weight: 600; color: #fff; }
            .check { position: absolute; left: 12px; color: var(--primary); }
          }
        }
      }
    }
    
    @keyframes slideDown { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }

    /* Back to Live button */
    .back-to-live-btn {
      position: absolute;
      top: 16px;
      left: 16px;
      z-index: 100;
      display: flex;
      align-items: center;
      gap: 0.4rem;
      background: rgba(220, 38, 38, 0.9);
      color: white;
      border: none;
      border-radius: 8px;
      padding: 0.5rem 1rem;
      font-size: 0.82rem;
      font-weight: 700;
      cursor: pointer;
      backdrop-filter: blur(4px);
      transition: all 0.2s;
      animation: pulseGlow 2s ease-in-out infinite;

      &:hover {
        background: rgba(220, 38, 38, 1);
        transform: scale(1.05);
      }
    }

    @keyframes pulseGlow {
      0%, 100% { box-shadow: 0 0 8px rgba(220, 38, 38, 0.4); }
      50% { box-shadow: 0 0 20px rgba(220, 38, 38, 0.7); }
    }

    /* Segment Timeline */
    .segment-timeline {
      overflow: hidden;
      width: 100%;
      max-width: 100%;
      box-sizing: border-box;
    }

    .timeline-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1rem;
      padding-bottom: 0.65rem;
      border-bottom: 1px solid var(--border);

      h3 {
        margin: 0;
        font-size: 0.95rem;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }
    }

    .segment-count {
      font-size: 0.78rem;
      color: var(--text-muted);
      background: #f1f5f9;
      padding: 0.25rem 0.6rem;
      border-radius: 12px;
      font-weight: 500;
    }

    .timeline-scroll {
      width: 100%;
      overflow-x: auto;
      padding-bottom: 0.8rem;
      scroll-behavior: smooth;

      /* Custom scrollbar */
      &::-webkit-scrollbar {
        height: 8px;
      }
      &::-webkit-scrollbar-track {
        background: #2a2a2a;
        border-radius: 4px;
      }
      &::-webkit-scrollbar-thumb {
        background: #555;
        border-radius: 4px;
        &:hover { background: #777; }
      }
    }

    .timeline-grid {
      display: flex;
      flex-wrap: nowrap;
      gap: 0.75rem;
      width: max-content;
      padding: 0 0.2rem;
    }

    .segment-card {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      gap: 0.6rem;
      padding: 0.6rem 0.8rem;
      background: #393737;
      border: 1px solid #4a4a4a;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.2s ease;
      min-width: 120px;
      flex: 0 0 auto;

      &:hover {
        background: #454545;
        border-color: #5a5a5a;
      }

      &.active {
        background: #4a4a4a;
        border-color: var(--primary);
      }
    }

    .segment-day {
      font-size: 0.85rem;
      color: #bfbfbf;
      text-align: center;
      width: 100%;
    }

    .segment-bottom {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
    }

    .segment-icon {
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .segment-time {
      font-size: 1.15rem;
      font-weight: 400;
      color: white;
      letter-spacing: 0.02em;
    }

    /* Info card */
    .info-card {
      .info-header {
        display: flex; justify-content: space-between; align-items: center;
        margin-bottom: 1rem; padding-bottom: 0.65rem; border-bottom: 1px solid var(--border);
        h3 { font-size: 0.95rem; font-weight: 600; margin: 0; padding: 0; border: none; }
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
export class PlayerPageComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('videoPlayer') videoElement!: ElementRef<HTMLVideoElement>;
  job: TranscodeJob | null = null;
  loading = true;
  videoError = false;
  nativeVideoUrl: string | undefined;
  retryTimeoutId: any;
  qualities: { id: number, label: string }[] = [];
  selectedQuality: number = -1;
  showQualityMenu = false;
  private hls: Hls | null = null;
  private shakaPlayer: any = null;

  // Segment timeline
  segments: LiveStreamSegment[] = [];
  playingSegment = false;
  playingSegmentId: number | null = null;
  private segmentRefreshInterval: any;

  constructor(private route: ActivatedRoute, private api: ApiService) { }

  get isLiveStream(): boolean {
    return this.job?.inputFileName === 'LIVE_STREAM';
  }

  ngOnInit() {
    const id = Number(this.route.snapshot.paramMap.get('jobId'));
    if (id) {
      this.api.getJob(id).subscribe({
        next: (j) => {
          this.job = j;
          this.loading = false;
          // Set native URL immediately for standard MP4
          const url = this.getVideoUrl();
          if (url && !url.endsWith('.m3u8') && !url.endsWith('.mpd')) {
            this.nativeVideoUrl = url;
          }
          // Load Player manually
          setTimeout(() => this.initPlayer(), 0);

          // Load segments for live streams
          if (this.isLiveStream) {
            this.loadSegments();
            this.segmentRefreshInterval = setInterval(() => this.loadSegments(), 15000);
          }
        },
        error: () => this.loading = false
      });
    } else { this.loading = false; }
  }

  ngAfterViewInit() {
    this.initPlayer();
  }

  ngOnDestroy() {
    if (this.retryTimeoutId) clearTimeout(this.retryTimeoutId);
    if (this.hls) {
      this.hls.destroy();
      this.hls = null;
    }
    if (this.shakaPlayer) {
      this.shakaPlayer.destroy();
      this.shakaPlayer = null;
    }
    if (this.segmentRefreshInterval) clearInterval(this.segmentRefreshInterval);
  }

  loadSegments() {
    if (!this.job) return;
    this.api.getSegments(this.job.id).subscribe({
      next: (segs) => this.segments = segs,
      error: () => { /* silently ignore */ }
    });
  }

  private initPlayer() {
    this.qualities = [];
    this.selectedQuality = -1;

    if (!this.job || !this.videoElement) return;

    const url = this.getVideoUrl();
    if (!url) return;

    const video = this.videoElement.nativeElement;

    if (this.retryTimeoutId) clearTimeout(this.retryTimeoutId);

    if (url.endsWith('.m3u8')) {
      this.initHlsJs(url, video);
    } else if (url.endsWith('.mpd')) {
      this.initShaka(url, video);
    } else {
      // Standard MP4
      this.nativeVideoUrl = url;
    }
  }

  private initHlsJs(url: string, video: HTMLVideoElement) {
    if (Hls.isSupported()) {
      if (this.hls) this.hls.destroy();

      const isLive = this.job?.inputFileName === 'LIVE_STREAM' && !this.playingSegment;
      const hlsConfig = isLive ? {
        debug: false, enableWorker: true, lowLatencyMode: true, backBufferLength: 30, liveDurationParam: 'EXT-X-TARGETDURATION', liveSyncDurationCount: 3, liveMaxLatencyDurationCount: 7, maxLiveSyncPlaybackRate: 1.5, maxBufferLength: 8, maxMaxBufferLength: 16
      } : { debug: false };

      this.hls = new Hls(hlsConfig);
      this.hls.loadSource(url);
      this.hls.attachMedia(video);

      this.hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
        this.qualities = data.levels.map((l, i) => ({
          id: i, label: `${l.height}p (${Math.round(l.bitrate / 1024)}k)`
        })).sort((a, b) => b.id - a.id);
      });

      this.hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          const isLiveMode = this.job?.inputFileName === 'LIVE_STREAM' && !this.playingSegment;

          if (isLiveMode) {
            // For live streams, always do a full retry on any fatal error.
            // This handles the case where the m3u8 file doesn't exist yet (404)
            // because FFmpeg hasn't generated the first segments.
            console.log('Live stream fatal error, retrying in 3s...', data.type);
            this.triggerRetry();
          } else {
            // For VOD playback, try lighter recovery first
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                this.hls?.startLoad();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                this.hls?.recoverMediaError();
                break;
              default:
                this.triggerRetry();
                break;
            }
          }
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      this.nativeVideoUrl = url;
    } else {
      this.videoError = true;
    }
  }

  private initShaka(url: string, video: HTMLVideoElement) {
    if (this.shakaPlayer) this.shakaPlayer.destroy();

    shaka.polyfill.installAll();

    if (shaka.Player.isBrowserSupported()) {
      this.shakaPlayer = new shaka.Player(video);

      this.shakaPlayer.addEventListener('error', (event: any) => {
        console.error('Shaka player error', event.detail);
        this.triggerRetry();
      });

      this.shakaPlayer.load(url).then(() => {
        const tracks = this.shakaPlayer.getVariantTracks();
        this.qualities = tracks.map((t: any) => ({
          id: t.id, label: `${t.height}p (${Math.round(t.bandwidth / 1024)}k)`
        })).sort((a: any, b: any) => b.id - a.id);
      }).catch((error: any) => {
        console.error('Shaka player load error', error);
        this.triggerRetry();
      });
    } else {
      console.error('Browser not supported for Shaka player');
      this.videoError = true;
    }
  }

  private triggerRetry() {
    this.videoError = false;
    if (this.hls) { this.hls.destroy(); this.hls = null; }
    if (this.shakaPlayer) { this.shakaPlayer.destroy(); this.shakaPlayer = null; }

    if (this.retryTimeoutId) clearTimeout(this.retryTimeoutId);

    this.retryTimeoutId = setTimeout(() => {
      this.initPlayer();
    }, 3000);
  }

  toggleQualityMenu() {
    this.showQualityMenu = !this.showQualityMenu;
  }

  onQualitySelect(q: number) {
    this.onQualityChange({ target: { value: q } });
    this.showQualityMenu = false;
  }

  onQualityChange(event: any) {
    const q = Number(event.target.value);
    this.selectedQuality = q;

    if (this.hls) {
      if (q === -1) {
        this.hls.currentLevel = -1; // Auto
      } else {
        this.hls.currentLevel = q;
      }
    } else if (this.shakaPlayer) {
      if (q === -1) {
        this.shakaPlayer.configure({ abr: { enabled: true } });
      } else {
        this.shakaPlayer.configure({ abr: { enabled: false } });
        const tracks = this.shakaPlayer.getVariantTracks();
        const track = tracks.find((t: any) => t.id === q);
        if (track) {
          this.shakaPlayer.selectVariantTrack(track, true);
        }
      }
    }
  }

  getVideoUrl(): string { return this.job?.outputFileName ? `/videos/output/${this.job.outputFileName}` : ''; }

  onVideoError() {
    if (this.job?.inputFileName === 'LIVE_STREAM' && !this.playingSegment) {
      this.triggerRetry();
    } else {
      this.videoError = true;
    }
  }

  formatDate(d: string | null): string {
    if (!d) return '-';
    return new Date(d).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  // --- Segment Timeline Methods ---
  playSegment(seg: LiveStreamSegment) {
    if (!this.job || !this.videoElement) return;

    this.playingSegment = true;
    this.playingSegmentId = seg.id;

    // Destroy current player
    if (this.hls) { this.hls.destroy(); this.hls = null; }
    if (this.shakaPlayer) { this.shakaPlayer.destroy(); this.shakaPlayer = null; }

    const video = this.videoElement.nativeElement;
    const segmentUrl = `/videos/output/recordings/job_${this.job.id}/${seg.fileName}`;
    this.nativeVideoUrl = segmentUrl;
    video.src = segmentUrl;
    video.load();
    video.play().catch(() => { });
  }

  backToLive() {
    this.playingSegment = false;
    this.playingSegmentId = null;
    this.nativeVideoUrl = undefined;

    // Re-initialize the live player
    setTimeout(() => this.initPlayer(), 100);
  }

  getDayName(dateStr: string): string {
    const d = new Date(dateStr);
    const days = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
    return days[d.getDay()];
  }

  formatSegmentTime(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  }
}

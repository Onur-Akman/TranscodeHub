import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService, EncodingPreset } from '../../services/api.service';

@Component({
    selector: 'app-transcode-page',
    standalone: true,
    imports: [CommonModule, FormsModule, RouterLink],
    template: `
    <div class="animate-in">
      <div class="page-header">
        <h1>Start Transcode</h1>
        <p>Select a video and encoding preset to begin transcoding</p>
      </div>

      <div class="card form-card">
        <div class="form-grid">
          <div class="form-group">
            <label>Type</label>
            <select [(ngModel)]="type" name="type">
              <option value="transcode">Transcode</option>
            </select>
          </div>

          <div class="form-group">
            <label>Video File</label>
            <div class="input-row">
              <select [(ngModel)]="selectedVideo" name="selectedVideo" class="flex-input">
                <option value="" disabled>Select a video...</option>
                <option *ngFor="let v of inputVideos" [value]="v">{{ v }}</option>
              </select>
              <label class="btn btn-secondary upload-btn">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="17 8 12 3 7 8"></polyline>
                  <line x1="12" y1="3" x2="12" y2="15"></line>
                </svg>
                Upload
                <input type="file" accept="video/*" (change)="onFileSelect($event)" hidden>
              </label>
            </div>
            <div class="upload-msg" *ngIf="uploading">Uploading {{ uploadFileName }}...</div>
            <div class="upload-msg success" *ngIf="uploadSuccess">{{ uploadFileName }} uploaded!</div>
          </div>

          <div class="form-group">
            <label>Encoding Preset</label>
            <select [(ngModel)]="selectedPresetId" name="preset">
              <option [ngValue]="null" disabled>Select a preset...</option>
              <option *ngFor="let p of presets" [ngValue]="p.id">
                {{ p.name }} — {{ getCodecLabel(p.videoCodec) }} {{ p.resolution }}
              </option>
            </select>
            <div class="no-presets" *ngIf="presets.length === 0 && !loadingPresets">
              No presets. <a routerLink="/presets">Create one first</a>
            </div>
          </div>
        </div>

        <!-- Selected Preset Preview -->
        <div class="preset-preview" *ngIf="selectedPresetDetail">
          <div class="preview-item"><span>Codec:</span> {{ getCodecLabel(selectedPresetDetail.videoCodec) }}</div>
          <div class="preview-item"><span>Audio:</span> {{ selectedPresetDetail.audioCodec | uppercase }}</div>
          <div class="preview-item"><span>Resolution:</span> {{ selectedPresetDetail.resolution }}</div>
          <div class="preview-item"><span>CRF:</span> {{ selectedPresetDetail.crf }}</div>
          <div class="preview-item"><span>Max Rate:</span> {{ selectedPresetDetail.maxRate }}</div>
          <div class="preview-item"><span>Speed:</span> {{ selectedPresetDetail.preset }}</div>
          <div class="preview-item"><span>Format:</span> {{ selectedPresetDetail.format | uppercase }}</div>
        </div>

        <button class="btn btn-primary btn-start" (click)="startTranscode()"
                [disabled]="!canStart || starting">
          {{ starting ? 'Starting...' : 'Start Transcoding' }}
        </button>
      </div>
    </div>
  `,
    styles: [`
    .form-card { max-width: 700px; }

    .form-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 0;
    }

    .input-row {
      display: flex; align-items: center; gap: 0.5rem;
      .flex-input { flex: 1; }
      .upload-btn { white-space: nowrap; flex-shrink: 0; }
    }

    .upload-msg {
      font-size: 0.8rem; margin-top: 0.35rem; color: var(--text-secondary);
      &.success { color: var(--success); }
    }

    .no-presets {
      font-size: 0.8rem; margin-top: 0.35rem; color: var(--text-muted);
      a { color: var(--primary); text-decoration: none; &:hover { text-decoration: underline; } }
    }

    .preset-preview {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
      gap: 0.5rem; padding: 1rem; background: #f8fafc; border-radius: var(--radius-sm);
      border: 1px solid var(--border); margin-bottom: 1.25rem;

      .preview-item {
        font-size: 0.82rem; color: var(--text-primary);
        span { color: var(--text-muted); margin-right: 0.15rem; }
      }
    }

    .btn-start { margin-top: 0.5rem; padding: 0.65rem 2rem; }
  `]
})
export class TranscodePageComponent implements OnInit {
    type = 'transcode';
    inputVideos: string[] = [];
    presets: EncodingPreset[] = [];
    selectedVideo = '';
    selectedPresetId: number | null = null;
    loadingPresets = true;
    uploading = false;
    uploadFileName = '';
    uploadSuccess = false;
    starting = false;

    constructor(private api: ApiService, private router: Router) { }

    ngOnInit() {
        this.api.getInputVideos().subscribe(v => this.inputVideos = v);
        this.api.getPresets().subscribe({ next: (p) => { this.presets = p; this.loadingPresets = false; }, error: () => this.loadingPresets = false });
    }

    get selectedPresetDetail(): EncodingPreset | undefined {
        return this.selectedPresetId ? this.presets.find(p => p.id === this.selectedPresetId) : undefined;
    }
    get canStart(): boolean { return !!this.selectedVideo && !!this.selectedPresetId; }

    getCodecLabel(codec: string): string {
        const m: Record<string, string> = { 'libx264': 'H.264', 'libx265': 'H.265', 'libvpx-vp9': 'VP9' };
        return m[codec] || codec;
    }

    onFileSelect(event: Event) {
        const input = event.target as HTMLInputElement;
        if (!input.files?.length) return;
        const file = input.files[0];
        this.uploadFileName = file.name;
        this.uploading = true;
        this.uploadSuccess = false;
        this.api.uploadVideo(file).subscribe({
            next: (res) => {
                this.uploading = false; this.uploadSuccess = true;
                this.selectedVideo = res.fileName;
                this.api.getInputVideos().subscribe(v => this.inputVideos = v);
                setTimeout(() => this.uploadSuccess = false, 4000);
            },
            error: () => { this.uploading = false; alert('Upload failed'); }
        });
    }

    startTranscode() {
        if (!this.canStart) return;
        this.starting = true;
        this.api.startTranscode({ inputFileName: this.selectedVideo, presetId: this.selectedPresetId! }).subscribe({
            next: () => { this.starting = false; this.router.navigate(['/status']); },
            error: (err) => { this.starting = false; alert('Failed: ' + (err.error?.error || err.message)); }
        });
    }
}

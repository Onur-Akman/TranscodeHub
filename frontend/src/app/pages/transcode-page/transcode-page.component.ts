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
        <p>Select a video, output format, and encoding preset(s) to begin transcoding.</p>
      </div>

      <div class="card form-card">
        <div class="form-grid">
          
          <div class="form-group">
            <label>Output Format</label>
            <select [(ngModel)]="outputFormat" name="outputFormat">
              <option value="MP4">Standard MP4 (Single Preset)</option>
              <option value="HLS">Apple HLS (Multi-Bitrate)</option>
              <option value="DASH">MPEG DASH (Multi-Bitrate)</option>
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
            <label>Encoding Preset(s) <span class="hint" *ngIf="outputFormat !== 'MP4'">(Hold Ctrl/Cmd to select multiple)</span></label>
            <!-- Single Select for MP4 -->
            <select *ngIf="outputFormat === 'MP4'" [(ngModel)]="selectedPresetIds" name="presetsSingle" multiple class="multi-select" style="height: 120px;">
              <option *ngFor="let p of presets" [ngValue]="p.id">
                {{ p.name }} — {{ getCodecLabel(p.videoCodec) }} {{ p.resolution }}
              </option>
            </select>
            <!-- Multi Select for HLS/DASH -->
            <select *ngIf="outputFormat !== 'MP4'" [(ngModel)]="selectedPresetIds" name="presetsMulti" multiple class="multi-select">
              <option *ngFor="let p of presets" [ngValue]="p.id">
                {{ p.name }} — {{ getCodecLabel(p.videoCodec) }} {{ p.resolution }}
              </option>
            </select>
            
            <div class="no-presets" *ngIf="presets.length === 0 && !loadingPresets">
              No presets. <a routerLink="/presets">Create one first</a>
            </div>
            <div class="no-presets text-danger" *ngIf="outputFormat === 'MP4' && selectedPresetIds.length > 1">
              Warning: MP4 format only supports 1 preset. Only the first will be used.
            </div>
          </div>
        </div>

        <!-- Selected Preset Preview -->
        <div *ngIf="selectedPresetDetails.length > 0">
           <label style="font-size: 0.85rem; font-weight: 600; margin-bottom: 0.5rem; display: block; color: var(--text-secondary);">Selected Qualities ({{selectedPresetDetails.length}})</label>
           <div class="preset-preview" *ngFor="let detail of selectedPresetDetails">
             <div class="preview-item" style="font-weight: 600; color: var(--primary);">{{ detail.name }}</div>
             <div class="preview-item"><span>Codec:</span> {{ getCodecLabel(detail.videoCodec) }}</div>
             <div class="preview-item"><span>Audio:</span> {{ detail.audioCodec | uppercase }}</div>
             <div class="preview-item"><span>Resolution:</span> {{ detail.resolution }}</div>
             <div class="preview-item"><span>CRF:</span> {{ detail.crf }}</div>
             <div class="preview-item"><span>Max Rate:</span> {{ detail.maxRate }}</div>
             <div class="preview-item"><span>Speed:</span> {{ detail.preset }}</div>
           </div>
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
      gap: 1.25rem;
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
    
    .hint {
      font-size: 0.75rem; color: var(--text-muted); font-weight: 400; margin-left: 0.5rem;
    }

    .multi-select {
      height: 180px;
      padding: 0.5rem;
      option { padding: 0.5rem; border-radius: 4px; margin-bottom: 2px; }
    }

    .no-presets {
      font-size: 0.8rem; margin-top: 0.35rem; color: var(--text-muted);
      a { color: var(--primary); text-decoration: none; &:hover { text-decoration: underline; } }
    }

    .preset-preview {
      display: flex; flex-wrap: wrap; align-items: center;
      gap: 1rem; padding: 0.75rem 1rem; background: #f8fafc; border-radius: var(--radius-sm);
      border: 1px solid var(--border); margin-bottom: 0.5rem;

      .preview-item {
        font-size: 0.82rem; color: var(--text-primary);
        span { color: var(--text-muted); margin-right: 0.15rem; }
      }
    }

    .btn-start { margin-top: 1rem; padding: 0.65rem 2rem; width: 100%; }
  `]
})
export class TranscodePageComponent implements OnInit {
  outputFormat = 'HLS';
  inputVideos: string[] = [];
  presets: EncodingPreset[] = [];
  selectedVideo = '';
  selectedPresetIds: number[] = [];
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

  get selectedPresetDetails(): EncodingPreset[] {
    return this.presets.filter(p => this.selectedPresetIds.includes(p.id!));
  }

  get canStart(): boolean {
    return !!this.selectedVideo && this.selectedPresetIds.length > 0;
  }

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

    // If MP4, only send the first preset
    const finalPresets = this.outputFormat === 'MP4' ? [this.selectedPresetIds[0]] : this.selectedPresetIds;

    this.api.startTranscode({
      inputFileName: this.selectedVideo,
      presetIds: finalPresets,
      outputFormat: this.outputFormat
    }).subscribe({
      next: () => { this.starting = false; this.router.navigate(['/status']); },
      error: (err) => { this.starting = false; alert('Failed: ' + (err.error?.error || err.message)); }
    });
  }
}

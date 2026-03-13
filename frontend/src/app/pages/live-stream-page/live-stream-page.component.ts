import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService, EncodingPreset } from '../../services/api.service';

@Component({
  selector: 'app-live-stream-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="animate-in">
      <div class="page-header">
        <h1>Live Stream Transcode</h1>
        <p>Start a multi-bitrate transcoding job for a live RTMP stream.</p>
      </div>

      <div class="card form-card">
        <div class="form-grid">
          
          <div class="form-group">
            <label>Output Format</label>
            <select [(ngModel)]="outputFormat" name="outputFormat">
              <option value="HLS">Apple HLS (Multi-Bitrate)</option>
              <option value="DASH">MPEG DASH (Multi-Bitrate)</option>
            </select>
          </div>

          <div class="form-group">
            <label>RTMP Stream URL</label>
            <div class="input-row">
              <input type="text" [(ngModel)]="inputUrl" name="inputUrl" 
                     class="flex-input text-input" 
                     placeholder="rtmp://transcoder-nginx:1935/live/streamkey">
            </div>
            <p class="hint">
              Enter the internal URL that the transcoder service can access. 
              Example: <code>rtmp://transcoder-nginx:1935/live/test</code>
            </p>
          </div>

          <div class="form-group">
            <label>Encoding Preset(s) <span class="hint">(Hold Ctrl/Cmd to select multiple)</span></label>
            <select [(ngModel)]="selectedPresetIds" name="presetsMulti" multiple class="multi-select">
              <option *ngFor="let p of presets" [ngValue]="p.id">
                {{ p.name }} — {{ getCodecLabel(p.videoCodec) }} {{ p.resolution || 'Original' }}
              </option>
            </select>
            
            <div class="no-presets" *ngIf="presets.length === 0 && !loadingPresets">
              No presets. <a routerLink="/presets">Create one first</a>
            </div>
          </div>
        </div>

        <!-- Selected Preset Preview -->
        <div *ngIf="selectedPresetDetails.length > 0" style="margin-top: 1rem;">
           <label style="font-size: 0.85rem; font-weight: 600; margin-bottom: 0.5rem; display: block; color: var(--text-secondary);">Selected Qualities ({{selectedPresetDetails.length}})</label>
           <div class="preset-preview" *ngFor="let detail of selectedPresetDetails">
             <div class="preview-item" style="font-weight: 600; color: var(--primary);">{{ detail.name }}</div>
             <div class="preview-item"><span>Codec:</span> {{ getCodecLabel(detail.videoCodec) }}</div>
             <div class="preview-item"><span>Audio:</span> {{ detail.audioCodec | uppercase }}</div>
             <div class="preview-item"><span>Resolution:</span> {{ detail.resolution || 'Original (Auto)' }}</div>
             <div class="preview-item"><span>Bitrate:</span> {{ detail.maxRate }}</div>
           </div>
        </div>

        <button class="btn btn-primary btn-start" (click)="startTranscode()"
                [disabled]="!canStart || starting">
          {{ starting ? 'Starting...' : 'Start Live Transcode' }}
        </button>
      </div>
    </div>
  `,
  styles: [`
    .form-card { max-width: 700px; }

    .form-grid {
      display: grid; grid-template-columns: 1fr; gap: 1.25rem;
    }

    .input-row {
      display: flex; align-items: center; gap: 0.5rem;
      .flex-input { flex: 1; padding: 0.7rem; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--bg-page); color: var(--text-primary); }
    }
    
    .hint { font-size: 0.75rem; color: var(--text-muted); margin-top: 0.25rem; }

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
      gap: 1rem; padding: 0.75rem 1rem; background: var(--bg-page); border-radius: var(--radius-sm);
      border: 1px solid var(--border); margin-bottom: 0.5rem;

      .preview-item {
        font-size: 0.82rem; color: var(--text-primary);
        span { color: var(--text-muted); margin-right: 0.15rem; }
      }
    }

    .btn-start { margin-top: 1rem; padding: 0.65rem 2rem; width: 100%; }
  `]
})
export class LiveStreamPageComponent implements OnInit {
  outputFormat = 'HLS';
  inputUrl = 'rtmp://transcoder-nginx:1935/live/test';
  presets: EncodingPreset[] = [];
  selectedPresetIds: number[] = [];
  loadingPresets = true;
  starting = false;

  constructor(private api: ApiService, private router: Router) { }

  ngOnInit() {
    this.api.getPresets().subscribe({
      next: (p) => { this.presets = p; this.loadingPresets = false; },
      error: () => this.loadingPresets = false
    });
  }

  get selectedPresetDetails(): EncodingPreset[] {
    return this.presets.filter(p => this.selectedPresetIds.includes(p.id!));
  }

  get canStart(): boolean {
    return !!this.inputUrl && this.selectedPresetIds.length > 0;
  }

  getCodecLabel(codec: string): string {
    const m: Record<string, string> = { 'libx264': 'H.264', 'libx265': 'H.265', 'libvpx-vp9': 'VP9' };
    return m[codec] || codec;
  }

  startTranscode() {
    if (!this.canStart) return;
    this.starting = true;

    this.api.startTranscode({
      inputUrl: this.inputUrl,
      presetIds: this.selectedPresetIds,
      outputFormat: this.outputFormat
    }).subscribe({
      next: () => { this.starting = false; this.router.navigate(['/status']); },
      error: (err) => { this.starting = false; alert('Failed: ' + (err.error?.error || err.message)); }
    });
  }
}

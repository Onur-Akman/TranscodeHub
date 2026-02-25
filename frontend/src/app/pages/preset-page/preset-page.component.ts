import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService, EncodingPreset } from '../../services/api.service';

@Component({
  selector: 'app-preset-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="animate-in">
      <div class="page-header">
        <h1>Encoding Presets</h1>
        <p>Create and manage your video encoding presets</p>
      </div>

      <!-- Existing Presets Table -->
      <div class="card table-card" *ngIf="presets.length > 0">
        <table class="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Video Codec</th>
              <th>Resolution</th>
              <th>CRF</th>
              <th>Max Rate</th>
              <th>Speed</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let preset of presets">
              <td class="cell-id">{{ preset.id }}</td>
              <td class="cell-name">{{ preset.name }}</td>
              <td><span class="badge badge-info">{{ getCodecLabel(preset.videoCodec) }}</span></td>
              <td>{{ preset.resolution }}</td>
              <td>{{ preset.crf }}</td>
              <td>{{ preset.maxRate }}</td>
              <td>{{ preset.preset }}</td>
              <td class="cell-actions">
                <button class="btn btn-secondary btn-sm" (click)="editPreset(preset)">Edit</button>
                <button class="btn btn-danger btn-sm" (click)="deletePreset(preset.id!)">Delete</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="card empty-card" *ngIf="presets.length === 0 && !loading">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="12" cy="12" r="3"></circle>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68 1.65 1.65 0 0 0 10 3.17V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
        </svg>
        <h3>No presets yet</h3>
        <p>Create your first encoding preset below</p>
      </div>

      <!-- Create / Edit Form -->
      <div class="card form-card">
        <h2>{{ editing ? 'Edit Preset' : 'Create New Preset' }}</h2>
        <form (ngSubmit)="savePreset()">
          <div class="form-grid">
            <div class="form-group">
              <label>Preset Name</label>
              <input type="text" [(ngModel)]="form.name" name="name" placeholder="e.g. H264-1080p-HQ" required>
            </div>
            <div class="form-group">
              <label>Video Codec</label>
              <select [(ngModel)]="form.videoCodec" name="videoCodec" required>
                <option value="libx264">H.264 (libx264)</option>
                <option value="libx265">H.265 / HEVC (libx265)</option>
                <option value="libvpx-vp9">VP9 (libvpx-vp9)</option>
              </select>
            </div>
            <div class="form-group">
              <label>Audio Codec</label>
              <select [(ngModel)]="form.audioCodec" name="audioCodec" required>
                <option value="aac">AAC</option>
                <option value="libopus">Opus</option>
              </select>
            </div>
            <div class="form-group">
              <label>Resolution</label>
              <select [(ngModel)]="form.resolution" name="resolution" required>
                <option value="3840x2160">3840x2160 (4K)</option>
                <option value="1920x1080">1920x1080 (1080p)</option>
                <option value="1280x720">1280x720 (720p)</option>
                <option value="854x480">854x480 (480p)</option>
              </select>
            </div>
            <div class="form-group">
              <label>CRF (Quality: {{ form.crf }})</label>
              <div class="slider-row">
                <input type="range" min="0" max="51" [(ngModel)]="form.crf" name="crf">
                <span class="slider-val">{{ form.crf }}</span>
              </div>
            </div>
            <div class="form-group">
              <label>Max Bitrate</label>
              <select [(ngModel)]="form.maxRate" name="maxRate" required>
                <option value="1000k">1000k</option>
                <option value="2000k">2000k</option>
                <option value="2500k">2500k</option>
                <option value="4000k">4000k</option>
                <option value="6000k">6000k</option>
                <option value="8000k">8000k</option>
                <option value="10000k">10000k</option>
              </select>
            </div>
            <div class="form-group">
              <label>Buffer Size</label>
              <select [(ngModel)]="form.bufSize" name="bufSize" required>
                <option value="2000k">2000k</option>
                <option value="4000k">4000k</option>
                <option value="5000k">5000k</option>
                <option value="8000k">8000k</option>
                <option value="10000k">10000k</option>
                <option value="16000k">16000k</option>
              </select>
            </div>
            <div class="form-group">
              <label>Audio Bitrate</label>
              <select [(ngModel)]="form.audioBitrate" name="audioBitrate" required>
                <option value="96k">96k</option>
                <option value="128k">128k</option>
                <option value="192k">192k</option>
                <option value="256k">256k</option>
                <option value="320k">320k</option>
              </select>
            </div>
            <div class="form-group">
              <label>Encoding Speed</label>
              <select [(ngModel)]="form.preset" name="preset" required>
                <option value="ultrafast">Ultra Fast</option>
                <option value="superfast">Super Fast</option>
                <option value="veryfast">Very Fast</option>
                <option value="faster">Faster</option>
                <option value="fast">Fast</option>
                <option value="medium">Medium</option>
                <option value="slow">Slow</option>
                <option value="slower">Slower</option>
                <option value="veryslow">Very Slow</option>
              </select>
            </div>
          </div>
          <div class="form-actions">
            <button type="submit" class="btn btn-primary" [disabled]="saving">
              {{ saving ? 'Saving...' : (editing ? 'Update Preset' : 'Create Preset') }}
            </button>
            <button type="button" class="btn btn-secondary" *ngIf="editing" (click)="cancelEdit()">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  `,
  styles: [`
    .table-card { padding: 0; overflow: hidden; margin-bottom: 1.5rem; }

    .data-table {
      width: 100%;
      border-collapse: collapse;

      th, td { padding: 0.7rem 1rem; text-align: left; white-space: nowrap; font-size: 0.85rem; }
      thead th {
        font-size: 0.72rem; font-weight: 600; text-transform: uppercase;
        letter-spacing: 0.05em; color: var(--text-secondary); background: #f8fafc;
        border-bottom: 1px solid var(--border);
      }
      tbody tr {
        border-bottom: 1px solid #f1f5f9; transition: background 0.15s;
        &:hover { background: #f8fafc; }
        &:last-child { border-bottom: none; }
      }
    }

    .cell-id { font-weight: 600; color: var(--text-secondary); }
    .cell-name { font-weight: 600; }
    .cell-actions { display: flex; gap: 0.4rem; }

    .empty-card {
      text-align: center; padding: 2.5rem 1rem; margin-bottom: 1.5rem;
      svg { margin-bottom: 0.5rem; opacity: 0.35; color: var(--text-muted); }
      h3 { color: var(--text-secondary); margin-bottom: 0.15rem; font-size: 0.95rem; }
      p { font-size: 0.85rem; color: var(--text-muted); }
    }

    .form-card {
      h2 { font-size: 1.1rem; font-weight: 600; margin-bottom: 1.25rem; color: var(--text-primary); }
    }

    .form-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      gap: 0 1.5rem;
    }

    .slider-row {
      display: flex; align-items: center; gap: 0.75rem;
      input[type="range"] {
        flex: 1; -webkit-appearance: none; height: 5px;
        background: #e2e8f0; border-radius: 3px; border: none; outline: none;
        &::-webkit-slider-thumb {
          -webkit-appearance: none; width: 18px; height: 18px; border-radius: 50%;
          background: var(--primary); cursor: pointer;
        }
      }
      .slider-val { font-weight: 700; font-size: 1rem; color: var(--primary); min-width: 2rem; text-align: center; }
    }

    .form-actions {
      display: flex; gap: 0.75rem; margin-top: 1.25rem;
      padding-top: 1.25rem; border-top: 1px solid var(--border);
    }
  `]
})
export class PresetPageComponent implements OnInit {
  presets: EncodingPreset[] = [];
  editing = false;
  editingId: number | null = null;
  saving = false;
  loading = true;
  form: EncodingPreset = this.getDefaultForm();

  constructor(private api: ApiService) { }
  ngOnInit() { this.loadPresets(); }

  getDefaultForm(): EncodingPreset {
    return { name: '', videoCodec: 'libx264', audioCodec: 'aac', resolution: '1920x1080', crf: 23, maxRate: '4000k', bufSize: '8000k', audioBitrate: '128k', preset: 'fast' };
  }

  loadPresets() {
    this.loading = true;
    this.api.getPresets().subscribe({ next: (p) => { this.presets = p; this.loading = false; }, error: () => this.loading = false });
  }

  getCodecLabel(codec: string): string {
    const m: Record<string, string> = { 'libx264': 'H.264', 'libx265': 'H.265', 'libvpx-vp9': 'VP9' };
    return m[codec] || codec;
  }

  savePreset() {
    this.saving = true;
    const obs = this.editing && this.editingId ? this.api.updatePreset(this.editingId, this.form) : this.api.createPreset(this.form);
    obs.subscribe({ next: () => { this.saving = false; this.cancelEdit(); this.loadPresets(); }, error: () => this.saving = false });
  }

  editPreset(preset: EncodingPreset) { this.editing = true; this.editingId = preset.id!; this.form = { ...preset }; }
  cancelEdit() { this.editing = false; this.editingId = null; this.form = this.getDefaultForm(); }
  deletePreset(id: number) { if (confirm('Delete this preset?')) { this.api.deletePreset(id).subscribe(() => this.loadPresets()); } }
}

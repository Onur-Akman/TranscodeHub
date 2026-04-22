import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-video-settings',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="settings-overlay">
      <button class="gear-btn" (click)="open = !open" title="Settings">
        <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
          <path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.06-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.73,8.87 C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.06,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.49-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z" />
        </svg>
      </button>
      <div class="settings-menu" *ngIf="open">
        <div class="menu-header" *ngIf="qualities.length > 0">Quality</div>
        <ul class="settings-list" *ngIf="qualities.length > 0">
          <li [class.active]="selectedQuality === -1" (click)="selectQuality(-1)">
            <span class="check" *ngIf="selectedQuality === -1">&#10003;</span> Auto
          </li>
          <li *ngFor="let q of qualities" [class.active]="selectedQuality === q.id" (click)="selectQuality(q.id)">
            <span class="check" *ngIf="selectedQuality === q.id">&#10003;</span> {{ q.label }}
          </li>
        </ul>
        <div class="menu-header" *ngIf="subtitles.length > 0">Subtitles</div>
        <ul class="settings-list" *ngIf="subtitles.length > 0">
          <li [class.active]="selectedSubtitle === null" (click)="selectSubtitle(null)">
            <span class="check" *ngIf="selectedSubtitle === null">&#10003;</span> Off
          </li>
          <li *ngFor="let s of subtitles; let i = index" [class.active]="selectedSubtitle === i" (click)="selectSubtitle(i)">
            <span class="check" *ngIf="selectedSubtitle === i">&#10003;</span> {{ s.language }}
          </li>
        </ul>
        <div class="menu-header" *ngIf="dubs.length > 0">Dubbing</div>
        <ul class="settings-list" *ngIf="dubs.length > 0">
          <li [class.active]="selectedDub === null" (click)="selectDub(null)">
            <span class="check" *ngIf="selectedDub === null">&#10003;</span> Original
          </li>
          <li *ngFor="let d of dubs; let i = index" [class.active]="selectedDub === i" (click)="selectDub(i)">
            <span class="check" *ngIf="selectedDub === i">&#10003;</span> {{ d.language }}
          </li>
        </ul>
      </div>
    </div>
  `,
  styles: [`
    .settings-overlay {
      position: absolute; right: 20px; top: 20px; z-index: 100;
    }

    .gear-btn {
      background: rgba(0, 0, 0, 0.6); color: white; border: none;
      border-radius: 50%; width: 40px; height: 40px;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; transition: all 0.2s; backdrop-filter: blur(4px);
      &:hover { background: rgba(0, 0, 0, 0.8); transform: scale(1.05); }
    }

    .settings-menu {
      position: absolute; right: 0; top: 48px;
      background: rgba(28, 28, 28, 0.95); color: white;
      border-radius: 8px; min-width: 160px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
      backdrop-filter: blur(8px); overflow: hidden;
      animation: slideDown 0.2s ease-out; transform-origin: top right;
    }

    .menu-header {
      padding: 10px 16px; font-weight: 600; font-size: 0.85rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      color: #999; text-transform: uppercase; letter-spacing: 0.05em;
    }

    .settings-list {
      list-style: none; padding: 6px 0; margin: 0;
      max-height: 250px; overflow-y: auto;
      li {
        padding: 8px 16px 8px 36px; cursor: pointer;
        font-size: 0.9rem; transition: background 0.15s; position: relative;
        &:hover { background: rgba(255, 255, 255, 0.1); }
        &.active { font-weight: 600; color: #fff; }
        .check { position: absolute; left: 12px; color: #3b82f6; }
      }
    }

    @keyframes slideDown {
      from { opacity: 0; transform: scale(0.95); }
      to { opacity: 1; transform: scale(1); }
    }
  `]
})
export class VideoSettingsComponent {
  @Input() qualities: { id: number; label: string }[] = [];
  @Input() subtitles: any[] = [];
  @Input() dubs: any[] = [];
  @Input() selectedQuality = -1;
  @Input() selectedSubtitle: number | null = null;
  @Input() selectedDub: number | null = null;

  @Output() qualityChange = new EventEmitter<number>();
  @Output() subtitleChange = new EventEmitter<number | null>();
  @Output() dubChange = new EventEmitter<number | null>();

  open = false;

  selectQuality(q: number) {
    this.qualityChange.emit(q);
    this.open = false;
  }

  selectSubtitle(i: number | null) {
    this.subtitleChange.emit(i);
    this.open = false;
  }

  selectDub(i: number | null) {
    this.dubChange.emit(i);
    this.open = false;
  }
}

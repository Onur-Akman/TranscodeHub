import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet, RouterLink, RouterLinkActive, NavigationEnd } from '@angular/router';
import { AuthService } from './services/auth.service';
import { filter } from 'rxjs';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <!-- Login page: no sidebar -->
    <ng-container *ngIf="isLoginPage">
      <router-outlet />
    </ng-container>

    <!-- App layout with sidebar -->
    <div class="app-layout" *ngIf="!isLoginPage">
      <aside class="sidebar">
        <div class="sidebar-brand">
          <span>Transcoder</span>
        </div>

        <nav class="sidebar-nav">
          <!-- Admin Panel (only for admins) -->
          <a *ngIf="isAdmin" routerLink="/admin" routerLinkActive="active" class="nav-item">
            <div class="nav-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
              </svg>
            </div>
            <span>Admin Panel</span>
          </a>

          <a *ngIf="isAdmin" routerLink="/status" routerLinkActive="active" class="nav-item">
            <div class="nav-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="7" height="7"></rect>
                <rect x="14" y="3" width="7" height="7"></rect>
                <rect x="14" y="14" width="7" height="7"></rect>
                <rect x="3" y="14" width="7" height="7"></rect>
              </svg>
            </div>
            <span>Dashboard</span>
          </a>
          <a *ngIf="isAdmin" routerLink="/presets" routerLinkActive="active" class="nav-item">
            <div class="nav-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
              </svg>
            </div>
            <span>Presets</span>
          </a>
          <a *ngIf="isAdmin" routerLink="/transcode" routerLinkActive="active" class="nav-item">
            <div class="nav-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="16 16 12 12 8 16"></polyline>
                <line x1="12" y1="12" x2="12" y2="21"></line>
                <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"></path>
              </svg>
            </div>
            <span>Transcode</span>
          </a>
          <a *ngIf="isAdmin" routerLink="/live-stream" routerLinkActive="active" class="nav-item">
            <div class="nav-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M23 7l-7 5 7 5V7z"></path>
                <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
              </svg>
            </div>
            <span>Live Stream</span>
          </a>
          <a routerLink="/cms" routerLinkActive="active" class="nav-item">
            <div class="nav-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect>
                <line x1="7" y1="2" x2="7" y2="22"></line>
                <line x1="17" y1="2" x2="17" y2="22"></line>
                <line x1="2" y1="12" x2="22" y2="12"></line>
                <line x1="2" y1="7" x2="7" y2="7"></line>
                <line x1="2" y1="17" x2="7" y2="17"></line>
                <line x1="17" y1="7" x2="22" y2="7"></line>
                <line x1="17" y1="17" x2="22" y2="17"></line>
              </svg>
            </div>
            <span>CMS</span>
          </a>
          <a routerLink="/watch-party" routerLinkActive="active" class="nav-item">
            <div class="nav-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
            </div>
            <span>Watch Party</span>
          </a>
        </nav>
      </aside>

      <main class="main-content">
        <div class="top-bar">
          <div class="user-info">
            <span class="username">{{ currentUser?.username }}</span>
            <span class="role-badge" [class.admin]="isAdmin">{{ currentUser?.role }}</span>
          </div>
          <div class="top-actions">
            <button class="theme-toggle" (click)="toggleTheme()">
              <svg *ngIf="darkMode" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="5"></circle>
                <line x1="12" y1="1" x2="12" y2="3"></line>
                <line x1="12" y1="21" x2="12" y2="23"></line>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                <line x1="1" y1="12" x2="3" y2="12"></line>
                <line x1="21" y1="12" x2="23" y2="12"></line>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
              </svg>
              <svg *ngIf="!darkMode" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
              </svg>
            </button>
            <button class="btn-logout" (click)="logout()">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
              </svg>
              Log Out
            </button>
          </div>
        </div>
        <router-outlet />
      </main>
    </div>
  `,
  styles: [`
    :host { display: block; min-height: 100vh; }
    .app-layout { display: flex; min-height: 100vh; }

    .sidebar {
      width: var(--sidebar-width); background: var(--sidebar-bg);
      display: flex; flex-direction: column; position: fixed;
      top: 0; left: 0; bottom: 0; z-index: 100; overflow-y: auto;
    }

    .sidebar-brand {
      display: flex; align-items: center; gap: 0.65rem;
      padding: 1.25rem 1.25rem 2rem; color: #fff;
      font-size: 1.1rem; font-weight: 700;
      svg { color: var(--primary-light); flex-shrink: 0; }
    }

    .sidebar-nav { display: flex; flex-direction: column; gap: 0.2rem; padding: 0 0.75rem; }

    .nav-item {
      display: flex; align-items: center; gap: 0.75rem;
      padding: 0.7rem 0.85rem; border-radius: 8px;
      color: var(--sidebar-text); text-decoration: none;
      font-weight: 500; font-size: 0.88rem; transition: all 0.2s ease;
      &:hover { background: var(--sidebar-hover); color: var(--sidebar-text-active); }
      &.active { background: var(--sidebar-active); color: var(--sidebar-text-active); }
      .nav-icon {
        width: 36px; height: 36px; display: flex; align-items: center;
        justify-content: center; border-radius: 8px;
        background: rgba(255,255,255,0.06); flex-shrink: 0;
      }
      &.active .nav-icon { background: rgba(37,99,235,0.25); color: #60a5fa; }
    }

    .main-content {
      flex: 1; margin-left: var(--sidebar-width);
      padding: 0 2rem 1.75rem; min-height: 100vh; background: var(--bg-page);
      min-width: 0; overflow-x: hidden;
    }

    .top-bar {
      display: flex; align-items: center; justify-content: space-between;
      padding: 1rem 0; margin-bottom: 0.25rem;
    }

    .user-info {
      display: flex; align-items: center; gap: 0.5rem;
      .username { font-weight: 600; font-size: 0.88rem; color: var(--text-primary); }
      .role-badge {
        font-size: 0.68rem; font-weight: 600; padding: 0.15rem 0.5rem;
        border-radius: 12px; background: #eff6ff; color: #2563eb;
        text-transform: uppercase; letter-spacing: 0.03em;
        &.admin { background: #f5f3ff; color: #7c3aed; }
      }
    }

    :host-context(body.dark) .role-badge {
      background: rgba(37,99,235,0.15) !important; color: #60a5fa !important;
      &.admin { background: rgba(139,92,246,0.15) !important; color: #a78bfa !important; }
    }

    .top-actions { display: flex; align-items: center; gap: 0.5rem; }

    .theme-toggle {
      width: 40px; height: 40px; border-radius: 10px;
      border: 1px solid var(--border); background: var(--bg-card);
      color: var(--text-secondary); display: flex; align-items: center;
      justify-content: center; cursor: pointer; transition: all 0.2s ease;
      &:hover { background: var(--border); color: var(--text-primary); }
    }

    .btn-logout {
      display: inline-flex; align-items: center; gap: 0.4rem;
      padding: 0.5rem 1rem; border-radius: 8px; border: 1px solid #fecaca;
      background: #fef2f2; color: #dc2626; font-family: inherit;
      font-weight: 600; font-size: 0.82rem; cursor: pointer; transition: all 0.2s ease;
      &:hover { background: #fee2e2; }
    }

    :host-context(body.dark) .btn-logout {
      background: rgba(239,68,68,0.15); border-color: rgba(239,68,68,0.3);
      color: #f87171;
      &:hover { background: rgba(239,68,68,0.25); }
    }
  `]
})
export class AppComponent implements OnInit {
  darkMode = false;
  isLoginPage = true;

  constructor(private auth: AuthService, private router: Router) { }

  ngOnInit() {
    // Dark mode
    const saved = localStorage.getItem('theme');
    if (saved === 'dark') {
      this.darkMode = true;
      document.body.classList.add('dark');
    }

    // Track route changes to show/hide sidebar
    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd)
    ).subscribe((e: any) => {
      this.isLoginPage = e.urlAfterRedirects === '/login';
    });

    // Initial check
    this.isLoginPage = this.router.url === '/login' || this.router.url === '/';
  }

  get currentUser() {
    return this.auth.getUser();
  }

  get isAdmin(): boolean {
    return this.auth.isAdmin();
  }

  toggleTheme() {
    this.darkMode = !this.darkMode;
    if (this.darkMode) {
      document.body.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.body.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }

  logout() {
    this.auth.logout();
  }
}

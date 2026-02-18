import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
    selector: 'app-login-page',
    standalone: true,
    imports: [CommonModule, FormsModule],
    template: `
    <div class="login-wrapper">
      <div class="login-card">
        <div class="login-header">
          <h1>Video Transcoder</h1>
          <p>Sign in to your account</p>
        </div>

        <form (ngSubmit)="onLogin()">
          <div class="form-group">
            <label>Username</label>
            <input type="text" [(ngModel)]="username" name="username"
                   placeholder="Enter username" required autofocus>
          </div>
          <div class="form-group">
            <label>Password</label>
            <input type="password" [(ngModel)]="password" name="password"
                   placeholder="Enter password" required>
          </div>
          <div class="error-msg" *ngIf="error">{{ error }}</div>
          <button type="submit" class="btn btn-primary btn-login" [disabled]="loading">
            {{ loading ? 'Signing in...' : 'Sign In' }}
          </button>
        </form>
      </div>
    </div>
  `,
    styles: [`
    .login-wrapper {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--bg-page);
      padding: 1rem;
    }

    .login-card {
      width: 100%;
      max-width: 400px;
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 2.5rem 2rem;
      box-shadow: var(--shadow-lg);
    }

    .login-header {
      text-align: center;
      margin-bottom: 2rem;

      svg {
        color: var(--primary);
        margin-bottom: 0.75rem;
      }

      h1 {
        font-size: 1.35rem;
        font-weight: 700;
        color: var(--text-primary);
        margin-bottom: 0.25rem;
      }

      p {
        font-size: 0.88rem;
        color: var(--text-secondary);
      }
    }

    .error-msg {
      background: #fef2f2;
      color: #dc2626;
      padding: 0.6rem 0.85rem;
      border-radius: var(--radius-sm);
      font-size: 0.82rem;
      margin-bottom: 1rem;
      border: 1px solid #fecaca;
    }

    :host-context(body.dark) .error-msg {
      background: rgba(239, 68, 68, 0.15);
      border-color: rgba(239, 68, 68, 0.3);
    }

    .btn-login {
      width: 100%;
      padding: 0.7rem;
      font-size: 0.95rem;
      justify-content: center;
    }
  `]
})
export class LoginPageComponent {
    username = '';
    password = '';
    error = '';
    loading = false;

    constructor(private auth: AuthService, private router: Router) {
        if (auth.isLoggedIn()) {
            this.router.navigate([auth.isAdmin() ? '/admin' : '/status']);
        }
    }

    onLogin() {
        this.error = '';
        this.loading = true;

        this.auth.login(this.username, this.password).subscribe({
            next: (res) => {
                this.loading = false;
                if (res.role === 'ADMIN') {
                    this.router.navigate(['/admin']);
                } else {
                    this.router.navigate(['/status']);
                }
            },
            error: (err) => {
                this.loading = false;
                this.error = err.error?.error || 'Login failed. Please try again.';
            }
        });
    }
}

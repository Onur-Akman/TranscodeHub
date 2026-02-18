import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService, UserInfo } from '../../services/auth.service';

@Component({
    selector: 'app-admin-page',
    standalone: true,
    imports: [CommonModule, FormsModule],
    template: `
    <div class="animate-in">
      <div class="page-header">
        <h1>Admin Panel</h1>
        <p>Manage users and create new accounts</p>
      </div>

      <!-- Stats -->
      <div class="stats-row">
        <div class="stat-card">
          <div class="stat-icon blue">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
          </div>
          <div class="stat-info">
            <div class="stat-value">{{ users.length }}</div>
            <div class="stat-label">Total Users</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon purple">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
            </svg>
          </div>
          <div class="stat-info">
            <div class="stat-value">{{ adminCount }}</div>
            <div class="stat-label">Admins</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon teal">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
          </div>
          <div class="stat-info">
            <div class="stat-value">{{ userCount }}</div>
            <div class="stat-label">Regular Users</div>
          </div>
        </div>
      </div>

      <!-- Create User Form -->
      <div class="card form-card">
        <h2>Create New User</h2>
        <form (ngSubmit)="createUser()">
          <div class="form-grid">
            <div class="form-group">
              <label>Username</label>
              <input type="text" [(ngModel)]="form.username" name="username" placeholder="Username" required>
            </div>
            <div class="form-group">
              <label>Password</label>
              <input type="password" [(ngModel)]="form.password" name="password" placeholder="Password" required>
            </div>
            <div class="form-group">
              <label>Email</label>
              <input type="email" [(ngModel)]="form.email" name="email" placeholder="user@example.com" required
                     [class.input-error]="form.email && !isValidEmail(form.email)">
              <span class="field-error" *ngIf="form.email && !isValidEmail(form.email)">Invalid email format</span>
            </div>
            <div class="form-group">
              <label>Phone</label>
              <input type="text" [(ngModel)]="form.phone" name="phone" placeholder="+905551234567" required>
            </div>
          </div>
          <div class="form-actions">
            <button type="submit" class="btn btn-primary" [disabled]="saving || !isFormValid()">
              {{ saving ? 'Creating...' : 'Create User' }}
            </button>
          </div>
          <div class="success-msg" *ngIf="successMsg">{{ successMsg }}</div>
          <div class="error-msg" *ngIf="errorMsg">{{ errorMsg }}</div>
        </form>
      </div>

      <!-- Users Table -->
      <div class="card table-card" *ngIf="users.length > 0">
        <h2 class="table-title">All Users</h2>
        <table class="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Username</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Role</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let u of users">
              <td class="cell-id">{{ u.id }}</td>
              <td class="cell-name">{{ u.username }}</td>
              <td>{{ u.email }}</td>
              <td>{{ u.phone }}</td>
              <td>
                <span class="badge" [ngClass]="u.role === 'ADMIN' ? 'badge-purple' : 'badge-info'">{{ u.role }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `,
    styles: [`
    .form-card {
      margin-bottom: 1.5rem;
      h2 { font-size: 1.1rem; font-weight: 600; margin-bottom: 1.25rem; color: var(--text-primary); }
    }

    .form-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      gap: 0 1.5rem;
    }

    .form-actions {
      display: flex; gap: 0.75rem; margin-top: 1.25rem;
      padding-top: 1.25rem; border-top: 1px solid var(--border);
    }

    .input-error { border-color: var(--danger) !important; }
    .field-error { font-size: 0.75rem; color: var(--danger); margin-top: 0.2rem; display: block; }

    .success-msg {
      margin-top: 1rem; padding: 0.6rem 0.85rem; border-radius: var(--radius-sm);
      font-size: 0.82rem; background: #ecfdf5; color: #059669; border: 1px solid #a7f3d0;
    }
    :host-context(body.dark) .success-msg { background: rgba(16,185,129,0.15); border-color: rgba(16,185,129,0.3); }

    .error-msg {
      margin-top: 1rem; padding: 0.6rem 0.85rem; border-radius: var(--radius-sm);
      font-size: 0.82rem; background: #fef2f2; color: #dc2626; border: 1px solid #fecaca;
    }
    :host-context(body.dark) .error-msg { background: rgba(239,68,68,0.15); border-color: rgba(239,68,68,0.3); }

    .table-card {
      padding: 0; overflow: hidden;
      .table-title {
        font-size: 1.1rem; font-weight: 600; padding: 1.25rem 1.25rem 0.75rem;
        color: var(--text-primary);
      }
    }

    .data-table {
      width: 100%; border-collapse: collapse;
      th, td { padding: 0.7rem 1.25rem; text-align: left; font-size: 0.85rem; }
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
  `]
})
export class AdminPageComponent implements OnInit {
    users: UserInfo[] = [];
    form = { username: '', password: '', email: '', phone: '' };
    saving = false;
    successMsg = '';
    errorMsg = '';

    private emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

    constructor(private auth: AuthService) { }

    ngOnInit() { this.loadUsers(); }

    get adminCount(): number { return this.users.filter(u => u.role === 'ADMIN').length; }
    get userCount(): number { return this.users.filter(u => u.role === 'USER').length; }

    loadUsers() {
        this.auth.getUsers().subscribe({ next: (u) => this.users = u, error: () => {} });
    }

    isValidEmail(email: string): boolean {
        return this.emailRegex.test(email);
    }

    isFormValid(): boolean {
        return !!this.form.username && !!this.form.password && !!this.form.email
            && this.isValidEmail(this.form.email) && !!this.form.phone;
    }

    createUser() {
        if (!this.isFormValid()) return;
        this.saving = true;
        this.successMsg = '';
        this.errorMsg = '';

        this.auth.register(this.form).subscribe({
            next: (res) => {
                this.saving = false;
                this.successMsg = `User "${res.username}" created successfully`;
                this.form = { username: '', password: '', email: '', phone: '' };
                this.loadUsers();
                setTimeout(() => this.successMsg = '', 5000);
            },
            error: (err) => {
                this.saving = false;
                this.errorMsg = err.error?.error || 'Failed to create user';
                setTimeout(() => this.errorMsg = '', 5000);
            }
        });
    }
}

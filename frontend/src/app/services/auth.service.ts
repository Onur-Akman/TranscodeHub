import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';

export interface LoginResponse {
    token: string;
    username: string;
    role: string;
}

export interface UserInfo {
    id: number;
    username: string;
    email: string;
    phone: string;
    role: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
    private baseUrl = '/api/auth';

    constructor(private http: HttpClient, private router: Router) { }

    login(username: string, password: string): Observable<LoginResponse> {
        return this.http.post<LoginResponse>(`${this.baseUrl}/login`, { username, password }).pipe(
            tap(res => {
                localStorage.setItem('token', res.token);
                localStorage.setItem('user', JSON.stringify({ username: res.username, role: res.role }));
            })
        );
    }

    register(data: { username: string; password: string; email: string; phone: string }): Observable<any> {
        return this.http.post(`${this.baseUrl}/register`, data);
    }

    getUsers(): Observable<UserInfo[]> {
        return this.http.get<UserInfo[]>(`${this.baseUrl}/users`);
    }

    logout(): void {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        this.router.navigate(['/login']);
    }

    getToken(): string | null {
        return localStorage.getItem('token');
    }

    getUser(): { username: string; role: string } | null {
        const data = localStorage.getItem('user');
        return data ? JSON.parse(data) : null;
    }

    isLoggedIn(): boolean {
        return !!this.getToken();
    }

    isAdmin(): boolean {
        const user = this.getUser();
        return user?.role === 'ADMIN';
    }
}

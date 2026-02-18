import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { tap } from 'rxjs';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
    const router = inject(Router);
    const token = localStorage.getItem('token');

    if (token && !req.url.includes('/api/auth/login')) {
        req = req.clone({
            setHeaders: { Authorization: `Bearer ${token}` }
        });
    }

    return next(req).pipe(
        tap({
            error: (err) => {
                if (err.status === 401 || err.status === 403) {
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                    router.navigate(['/login']);
                }
            }
        })
    );
};

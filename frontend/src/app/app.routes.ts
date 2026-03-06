import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import { adminGuard } from './guards/admin.guard';

export const routes: Routes = [
    { path: '', redirectTo: '/login', pathMatch: 'full' },
    {
        path: 'login',
        loadComponent: () => import('./pages/login-page/login-page.component').then(m => m.LoginPageComponent)
    },
    {
        path: 'admin',
        loadComponent: () => import('./pages/admin-page/admin-page.component').then(m => m.AdminPageComponent),
        canActivate: [adminGuard]
    },
    {
        path: 'presets',
        loadComponent: () => import('./pages/preset-page/preset-page.component').then(m => m.PresetPageComponent),
        canActivate: [authGuard]
    },
    {
        path: 'transcode',
        loadComponent: () => import('./pages/transcode-page/transcode-page.component').then(m => m.TranscodePageComponent),
        canActivate: [authGuard]
    },
    {
        path: 'status',
        loadComponent: () => import('./pages/status-page/status-page.component').then(m => m.StatusPageComponent),
        canActivate: [authGuard]
    },
    {
        path: 'live-stream',
        loadComponent: () => import('./pages/live-stream-page/live-stream-page.component').then(m => m.LiveStreamPageComponent),
        canActivate: [authGuard]
    },
    {
        path: 'cms',
        loadComponent: () => import('./pages/cms-page/cms-page.component').then(m => m.CmsPageComponent),
        canActivate: [authGuard]
    },
    {
        path: 'player/:jobId',
        loadComponent: () => import('./pages/player-page/player-page.component').then(m => m.PlayerPageComponent),
        canActivate: [authGuard]
    }
];

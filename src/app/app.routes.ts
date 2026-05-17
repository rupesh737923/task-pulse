import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth/auth.guard';
import { redirectAuthGuard } from './core/guards/redirect-auth.guard';

export const routes: Routes = [
    {
        path: 'profile',
        loadComponent: () => import('./pages/profile/profile.component').then(m => m.ProfileComponent),
        canActivate: [authGuard] // check if user is authenticated
    },
    {
        path: 'convert',
        loadComponent: () => import('./pages/convert/document-convertor.component').then(m => m.DocumentConvertorComponent),
        canActivate: [authGuard]
    },
    {
        path: 'video-convert',
        loadComponent: () => import('./pages/convert/video-convertor.component').then(m => m.VideoConvertorComponent),
        canActivate: [authGuard]
    },
    // Use lazy loading for multiple related screens/routes
    {
        path: 'task',
        loadChildren: () => import('./pages/task/task.routes').then(m => m.TASK_ROUTES),
        canActivate: [authGuard]
    },
    // Use lazy loading for single screen
    {
        path: 'login',
        loadComponent: () => import('./pages/login/login.component').then(m => m.LoginComponent),
        canActivate: [redirectAuthGuard]
    },
    {
        path: 'sign-up',
        loadComponent: () => import('./pages/sign-up/sign-up.component').then(m => m.SignUpComponent),
        canActivate: [redirectAuthGuard]
    },
    {
        path: 'forgot-password',
        loadComponent: () => import('./pages/forgot-password/forgot-password.component').then(m => m.ForgotPasswordComponent),
        canActivate: [redirectAuthGuard]
    },
    {
        path: 'reset-password',
        loadComponent: () => import('./pages/reset-password/reset-password.component').then(m => m.ResetPasswordComponent),
        canActivate: [redirectAuthGuard]
    },
    {
        path: '',
        redirectTo: 'login',
        pathMatch: 'full'
    },
    {
        path: '**',
        redirectTo: 'login'
    }
];

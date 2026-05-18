import { CommonModule } from '@angular/common';
import { Component, ChangeDetectorRef } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { Router, NavigationStart, NavigationEnd, NavigationCancel, NavigationError } from '@angular/router';

import { APP_CONSTANTS } from './core/constants/app.constants';
import { AuthService } from './core/services/auth.service';
import { NotificationService } from './services/notification.service';

import { ThemeService } from './core/services/theme.service';
import { environment } from '../environments/environment';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, CommonModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  appName = APP_CONSTANTS.APP_NAME;
  logoUrl = environment.logoUrl;
  isLoading = false;
  private minLoaderDuration = 300; // minimum 500ms to show the beautiful loader
  private loaderStartTime = 0;

  constructor(
    public router: Router,
    private cdr: ChangeDetectorRef,
    public authService: AuthService,
    private notificationService: NotificationService,
    public themeService: ThemeService
  ) {
    if (this.authService.currentUserValue) {
      this.notificationService.subscribeToNotifications();
    }
    this.router.events.subscribe(event => {
      // Close mobile menu on any navigation
      if (event instanceof NavigationStart) {
        this.closeMobileMenu();
        this.isLoading = true;
        this.loaderStartTime = Date.now();
        this.cdr.detectChanges(); // Force view update immediately
      }

      if (
        event instanceof NavigationEnd ||
        event instanceof NavigationCancel ||
        event instanceof NavigationError
      ) {
        const timeElapsed = Date.now() - this.loaderStartTime;
        const timeRemaining = Math.max(0, this.minLoaderDuration - timeElapsed);

        setTimeout(() => {
          this.isLoading = false;
          this.cdr.detectChanges();
        }, timeRemaining);
      }
    });
  }

  isMobileMenuOpen = false;
  isGuestMobileMenuOpen = false;
  isMyListsCollapsed = false;

  toggleMyLists(): void {
    this.isMyListsCollapsed = !this.isMyListsCollapsed;
  }
  isUtilityMenuOpen = false;
  isGuestUtilityMenuOpen = false;

  toggleMobileMenu(): void {
    this.isMobileMenuOpen = !this.isMobileMenuOpen;
  }

  toggleGuestMobileMenu(): void {
    this.isGuestMobileMenuOpen = !this.isGuestMobileMenuOpen;
  }

  toggleUtilityMenu(event?: Event): void {
    if (event) {
      event.preventDefault();
    }
    this.isUtilityMenuOpen = !this.isUtilityMenuOpen;
  }

  toggleGuestUtilityMenu(event?: Event): void {
    if (event) {
      event.preventDefault();
    }
    this.isGuestUtilityMenuOpen = !this.isGuestUtilityMenuOpen;
  }

  closeMobileMenu(): void {
    if (this.isMobileMenuOpen) {
      this.isMobileMenuOpen = false;
    }
    if (this.isGuestMobileMenuOpen) {
      this.isGuestMobileMenuOpen = false;
    }
  }
}

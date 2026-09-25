import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Auth } from '../../core/auth/auth';

@Component({
  selector: 'app-dashboard',
  imports: [],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard {
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);

  protected readonly usuario = this.auth.usuario;

  protected sair(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}

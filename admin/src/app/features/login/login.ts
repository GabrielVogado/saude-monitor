import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AcessoNaoAdminError, Auth } from '../../core/auth/auth';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);

  protected readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  protected readonly carregando = signal(false);
  protected readonly erro = signal<string | null>(null);
  /** Chegou aqui porque a sessão venceu e não pôde ser renovada (ver `authInterceptor`). */
  protected readonly sessaoExpirada =
    inject(ActivatedRoute, { optional: true })?.snapshot.queryParamMap.get('sessao') === 'expirada';

  protected enviar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.carregando.set(true);
    this.erro.set(null);
    const { email, password } = this.form.getRawValue();
    this.auth.login(email, password).subscribe({
      next: () => {
        this.carregando.set(false);
        // Login válido mas a tela não abre (ex.: chunk do painel não carrega após um deploy):
        // sem isto o botão destravava e nada acontecia.
        this.router.navigate(['/dashboard']).catch(() => {
          this.erro.set('Login feito, mas não foi possível abrir o painel. Recarregue a página.');
        });
      },
      error: (e: unknown) => {
        this.carregando.set(false);
        this.erro.set(this.mensagemDeErro(e));
      },
    });
  }

  private mensagemDeErro(e: unknown): string {
    if (e instanceof AcessoNaoAdminError) {
      return e.message;
    }
    if (e instanceof HttpErrorResponse) {
      if (e.status === 401 || e.status === 403) {
        return 'E-mail ou senha inválidos.';
      }
      if (e.status === 0) {
        return 'Não foi possível conectar ao servidor. Tente novamente.';
      }
      const doServidor = (e.error?.message ?? e.error?.error) as string | undefined;
      return doServidor || `Falha na autenticação (HTTP ${e.status}).`;
    }
    return 'Falha inesperada ao entrar.';
  }
}

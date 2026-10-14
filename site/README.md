# Site público do Radar Saúde

Páginas estáticas exigidas pela Play Store, publicadas em `https://saudemonitor.dev`:

| Página | Endereço | Onde a Play Console pede |
|---|---|---|
| Política de Privacidade | `https://saudemonitor.dev/privacidade` | *Conteúdo do app → Política de privacidade* e ficha da loja |
| Exclusão de conta | `https://saudemonitor.dev/exclusao-de-conta` | *Conteúdo do app → Segurança dos dados → Exclusão de dados* |
| Termos de Uso | `https://saudemonitor.dev/termos` | aberta pelo app (cadastro e Perfil) |

São HTML puro, sem JavaScript nem cookies, com `public/estilo.css` compartilhado e
cabeçalhos de segurança em `public/_headers`.

## Publicar

Uma vez, com a conta Cloudflare onde está o domínio `saudemonitor.dev`:

```bash
cd site
npx wrangler@4 login
npx wrangler@4 deploy
```

O `wrangler.jsonc` cria o Worker `radar-saude-site` só com arquivos estáticos e liga o
domínio `saudemonitor.dev` a ele (*custom domain*). Para republicar depois de mudar um
texto, basta rodar o `deploy` de novo. Também dá para ligar o Worker ao repositório em
*Workers & Pages → radar-saude-site → Settings → Builds* (diretório raiz `site`), e aí
cada merge na `develop` publica sozinho.

## E-mail de contato

As páginas usam `privacidade@saudemonitor.dev`. Ele precisa receber e-mail antes da
publicação na loja: no Cloudflare, *saudemonitor.dev → Email → Email Routing*, crie o
endereço `privacidade` encaminhando para o e-mail do responsável.

## Ao mudar um texto

A Política e os Termos têm versão e data de vigência no topo. Mudança relevante sobe a
versão, e o app precisa avisar o usuário (a versão aceita no cadastro é a `1.0`).

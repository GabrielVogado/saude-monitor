#!/usr/bin/env node
// Hook SessionStart: injeta a matriz de roteamento de skills no contexto da sessao.
//
// Existe porque CLAUDE.md sozinho nao bastou: a regra de ativar skills por area
// estava escrita e mesmo assim nao era seguida (OBS-002). O hook faz o harness
// entregar a matriz em toda sessao, em vez de depender de o modelo ir busca-la.
//
// Nao usa jq de proposito: jq nao esta instalado nas maquinas do projeto, mas
// node esta (o frontend depende dele).
const fs = require('fs');
const path = require('path');

const raiz = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const arquivo = path.join(raiz, '.claude', 'skills-roteamento.md');

let contexto;
try {
  contexto = fs.readFileSync(arquivo, 'utf8');
} catch {
  // Sem a matriz nao ha o que injetar; falhar em silencio e melhor do que
  // quebrar o inicio da sessao.
  process.exit(0);
}

process.stdout.write(
  JSON.stringify({
    suppressOutput: true,
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: contexto,
    },
  })
);

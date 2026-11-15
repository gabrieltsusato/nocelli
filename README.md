# Nocelli Media Hub

Protótipo de API e interface para autenticação, envio e moderação de fotos de
máquinas.

## Executar

```powershell
npm install
npm start
```

Abra `http://localhost:3000/login.html`. Para desenvolvimento, `npm run dev`
reinicia o servidor automaticamente. Em produção, configure `JWT_SECRET` como
variável de ambiente; o servidor recusa iniciar em produção sem ela.

### Contas de demonstração

| Perfil | E-mail | Senha |
|---|---|---|
| Administrador | admin@nocelli.com.br | admin123 |
| Funcionário | joao@nocelli.com.br | func123 |
| Cliente | cliente@empresa.com | cliente123 |

As senhas são apenas para demonstração e devem ser substituídas antes de qualquer
implantação real.

## Verificação e entregáveis

- `npm test` executa os testes de integração e unidade com o runner nativo do Node.
- `npm run report:pdf` gera `docs/relatorio-tecnico.pdf`.
- `docs/plano-de-testes.md` descreve os cenários e resultados esperados.
- `docs/evidencia-testes.txt` contém a saída da última execução automatizada.

## Padrões GoF

- **Singleton:** `src/repositories/in-memory-repository.js` mantém um repositório
  compartilhado no processo.
- **Factory:** `src/factories/machine-factory.js` centraliza a criação de máquinas.
- **Strategy:** `src/strategies/image-validation-strategy.js` encapsula a regra
  de aceitação de imagens.

O repositório em memória é intencional para o protótipo: dados e auditoria são
perdidos quando o processo é reiniciado.

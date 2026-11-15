# Plano de testes — Nocelli Media Hub

## Objetivo

Verificar os principais fluxos de autenticação, autorização, upload, moderação,
consulta e exclusão lógica da API. Os testes automatizados são executados com o
runner nativo `node:test` e iniciam a aplicação em uma porta local temporária.

## Casos de teste

| ID | Cenário e passos | Resultado esperado |
|---|---|---|
| CT-01 | Entrar com credenciais válidas (incluindo variação de maiúsculas/espaços) e, em seguida, tentar senha incorreta. | Login válido retorna token e usuário; senha incorreta retorna HTTP 400. |
| CT-02 | Consultar máquinas sem token e tentar aprovar uma máquina usando perfil Cliente. | Sem token retorna HTTP 401; perfil sem permissão retorna HTTP 403. |
| CT-03 | Validar nomes de arquivo `.PNG` e `.exe` usando a estratégia de imagem. | PNG é aceito; extensão não permitida é rejeitada com mensagem de validação. |
| CT-04 | Funcionário envia foto; Cliente consulta; Admin aprova; Cliente consulta novamente. | Máquina é criada como PENDENTE, não aparece para Cliente antes da aprovação e aparece após aprovação. |
| CT-05 | Filtrar por status inválido, data inválida e modelo existente. | Status/data inválidos retornam HTTP 400; filtro válido retorna o registro correspondente. |
| CT-06 | Admin exclui logicamente uma máquina e consulta lista e relatório. | Máquina deixa de aparecer na listagem; relatório conta a exclusão lógica. |
| CT-07 | Solicitar o repositório mais de uma vez e tentar construí-lo diretamente. | Chamadas ao Singleton retornam a mesma instância; a construção fora do ponto de acesso é recusada. |
| CT-08 | Criar máquina pela Factory com dados mínimos opcionais. | Objeto recebe status inicial PENDENTE, descrição vazia e marca de não excluído. |

## Execução

```powershell
npm test
```

O resultado real da execução está registrado em `evidencia-testes.txt`.

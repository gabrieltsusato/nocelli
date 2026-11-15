const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { after, before, beforeEach, test } = require('node:test');
const { once } = require('node:events');

const { createApp } = require('../src/app');
const { MachineFactory } = require('../src/factories/machine-factory');
const { InMemoryRepository } = require('../src/repositories/in-memory-repository');
const { AllowedImageTypesStrategy } = require('../src/strategies/image-validation-strategy');

const repository = InMemoryRepository.getInstance();
const jwtSecret = 'test-secret-that-is-only-used-by-the-test-suite';
const testUploadsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nocelli-tests-'));
const app = createApp({ repository, jwtSecret, uploadsDir: testUploadsDir, publicDir: path.join(__dirname, '..', 'public') });

let server;
let baseUrl;

before(async () => {
  server = app.listen(0);
  await once(server, 'listening');
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

beforeEach(() => repository.reset());

after(async () => {
  await new Promise((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
  });
  fs.rmSync(testUploadsDir, { recursive: true, force: true });
});

async function login(email = 'admin@nocelli.com.br', senha = 'admin123') {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, senha })
  });
  return { response, data: await response.json() };
}

async function getToken(email, senha) {
  const result = await login(email, senha);
  assert.equal(result.response.status, 200);
  return result.data.token;
}

async function uploadMachine(token, { modelo = 'Torno Alpha', numeroSerie = 'TN-100', filename = 'maquina.png' } = {}) {
  const form = new FormData();
  form.append('modelo', modelo);
  form.append('numeroSerie', numeroSerie);
  form.append('descricao', 'Categoria: Tornos CNC | Tags: usinagem');
  form.append('foto', new Blob(['imagem de teste'], { type: 'image/png' }), filename);

  return fetch(`${baseUrl}/api/maquinas`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form
  });
}

test('login valida credenciais e retorna token e usuário', async () => {
  const result = await login(' ADMIN@NOCELLI.COM.BR ', 'admin123');
  assert.equal(result.response.status, 200);
  assert.ok(result.data.token);
  assert.equal(result.data.usuario.role, 'ADMIN');

  const invalid = await login('admin@nocelli.com.br', 'senha-errada');
  assert.equal(invalid.response.status, 400);
});

test('rotas protegidas exigem token e respeitam o perfil', async () => {
  const noToken = await fetch(`${baseUrl}/api/maquinas`);
  assert.equal(noToken.status, 401);

  const customerToken = await getToken('cliente@empresa.com', 'cliente123');
  const forbidden = await fetch(`${baseUrl}/api/maquinas/1/status`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${customerToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'APROVADO' })
  });
  assert.equal(forbidden.status, 403);
});

test('Strategy de imagem aceita formatos permitidos e rejeita outros', () => {
  const strategy = new AllowedImageTypesStrategy();
  assert.equal(strategy.validate({ originalname: 'foto.PNG' }), null);
  assert.match(strategy.validate({ originalname: 'arquivo.exe' }), /Formato de arquivo inválido/);
});

test('Singleton entrega a mesma instância do repositório', () => {
  assert.equal(InMemoryRepository.getInstance(), repository);
  assert.throws(() => new InMemoryRepository(), /Use InMemoryRepository\.getInstance/);
});

test('Factory cria máquina pendente com responsável e o cliente só vê após aprovação', async () => {
  const employeeToken = await getToken('joao@nocelli.com.br', 'func123');
  const created = await uploadMachine(employeeToken);
  assert.equal(created.status, 201);
  const { maquina } = await created.json();
  assert.equal(maquina.status, 'PENDENTE');
  assert.equal(maquina.responsavelUploadNome, 'João Funcionário');
  assert.equal(repository.getAuditLogs().length, 1);

  const customerToken = await getToken('cliente@empresa.com', 'cliente123');
  const hiddenFromCustomer = await fetch(`${baseUrl}/api/maquinas`, {
    headers: { Authorization: `Bearer ${customerToken}` }
  });
  assert.deepEqual(await hiddenFromCustomer.json(), []);

  const adminToken = await getToken('admin@nocelli.com.br', 'admin123');
  const approval = await fetch(`${baseUrl}/api/maquinas/${maquina.id}/status`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'APROVADO' })
  });
  assert.equal(approval.status, 200);

  const visibleToCustomer = await fetch(`${baseUrl}/api/maquinas`, {
    headers: { Authorization: `Bearer ${customerToken}` }
  });
  assert.equal((await visibleToCustomer.json()).length, 1);
});

test('filtros inválidos são rejeitados e filtros válidos encontram registros', async () => {
  const employeeToken = await getToken('joao@nocelli.com.br', 'func123');
  const uploadResponse = await uploadMachine(employeeToken);
  assert.equal(uploadResponse.status, 201);

  const invalidStatus = await fetch(`${baseUrl}/api/maquinas?status=desconhecido`, {
    headers: { Authorization: `Bearer ${employeeToken}` }
  });
  assert.equal(invalidStatus.status, 400);

  const invalidDates = await fetch(`${baseUrl}/api/maquinas?dataInicio=ontem-nao`, {
    headers: { Authorization: `Bearer ${employeeToken}` }
  });
  assert.equal(invalidDates.status, 400);

  const filtered = await fetch(`${baseUrl}/api/maquinas?modelo=alpha`, {
    headers: { Authorization: `Bearer ${employeeToken}` }
  });
  assert.equal((await filtered.json()).length, 1);
});

test('exclusão lógica remove a máquina da lista e atualiza o relatório', async () => {
  const employeeToken = await getToken('joao@nocelli.com.br', 'func123');
  const uploaded = await uploadMachine(employeeToken);
  const { maquina } = await uploaded.json();
  const adminToken = await getToken('admin@nocelli.com.br', 'admin123');

  const deletion = await fetch(`${baseUrl}/api/maquinas/${maquina.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert.equal(deletion.status, 200);

  const list = await fetch(`${baseUrl}/api/maquinas`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert.deepEqual(await list.json(), []);

  const report = await fetch(`${baseUrl}/api/relatorios/gerencial`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert.deepEqual(await report.json(), {
    totalCadastros: 0,
    pendentes: 0,
    aprovados: 0,
    rejeitados: 0,
    excluidasLogicamente: 1
  });
});

test('Factory mantém a convenção do domínio ao criar um objeto de máquina', () => {
  const machine = MachineFactory.create({
    id: 8,
    modelo: 'Fresadora',
    numeroSerie: 'FR-8',
    descricao: '',
    fotoUrl: '/uploads/fresadora.png',
    responsavel: { id: 2, nome: 'Operador' }
  });

  assert.equal(machine.id, 8);
  assert.equal(machine.status, 'PENDENTE');
  assert.equal(machine.descricao, '');
  assert.equal(machine.isDeleted, false);
});

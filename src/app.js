const bcrypt = require('bcryptjs');
const cors = require('cors');
const crypto = require('crypto');
const express = require('express');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');

const { MachineFactory } = require('./factories/machine-factory');
const { createAuthenticationMiddleware, authorizeRoles } = require('./middleware/authentication');
const { InMemoryRepository } = require('./repositories/in-memory-repository');
const { AllowedImageTypesStrategy } = require('./strategies/image-validation-strategy');

const VALID_STATUSES = ['PENDENTE', 'APROVADO', 'REJEITADO'];

function getValidId(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function validateDateFilters({ dataInicio, dataFim }) {
  if ((dataInicio && Number.isNaN(Date.parse(dataInicio))) ||
      (dataFim && Number.isNaN(Date.parse(dataFim)))) {
    return 'Informe datas válidas para o filtro.';
  }

  if (dataInicio && dataFim && new Date(dataInicio) > new Date(dataFim)) {
    return 'A data inicial não pode ser posterior à data final.';
  }

  return null;
}

function createApp({
  repository = InMemoryRepository.getInstance(),
  jwtSecret,
  uploadsDir = path.join(__dirname, '..', 'uploads'),
  publicDir = path.join(__dirname, '..', 'public'),
  imageValidationStrategy = new AllowedImageTypesStrategy()
} = {}) {
  const app = express();
  const autenticarToken = createAuthenticationMiddleware(jwtSecret);

  fs.mkdirSync(uploadsDir, { recursive: true });

  app.use(cors());
  app.use(express.json());

  // Servir arquivos estáticos do frontend e uploads
  if (publicDir) {
    app.use(express.static(publicDir));
  }
  app.use('/uploads', express.static(uploadsDir));

  // Redirecionar raiz '/' para a tela de login
  if (publicDir) {
    app.get('/', (_req, res) => {
      res.sendFile(path.join(publicDir, 'login.html'));
    });
  }

  // Configuração do Multer para upload de fotos
  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${crypto.randomUUID()}${ext}`);
    }
  });

  const upload = multer({
    storage,
    fileFilter: (_req, file, cb) => {
      const error = imageValidationStrategy.validate(file);
      if (error) {
        return cb(new Error(error));
      }
      return cb(null, true);
    }
  });

  // 1. Login
  app.post('/api/auth/login', (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const senha = String(req.body?.senha || '');

    const user = repository.getUserByEmail(email);
    if (!user || !bcrypt.compareSync(senha, user.senhaHash)) {
      return res.status(400).json({ mensagem: 'E-mail ou senha inválidos.' });
    }

    const payload = { id: user.id, nome: user.nome, email: user.email, role: user.role };
    const token = jwt.sign(payload, jwtSecret, { expiresIn: '8h' });

    return res.json({ token, usuario: payload });
  });

  // 2. Listar máquinas com filtros e regras de perfil
  app.get('/api/maquinas', autenticarToken, (req, res) => {
    const { status, modelo, dataInicio, dataFim } = req.query;

    if (status && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ mensagem: 'Status de filtro inválido.' });
    }

    const dateError = validateDateFilters({ dataInicio, dataFim });
    if (dateError) {
      return res.status(400).json({ mensagem: dateError });
    }

    let maquinas = repository.listMachines().filter(m => !m.isDeleted);

    if (req.user.role === 'CLIENTE') {
      maquinas = maquinas.filter(m => m.status === 'APROVADO');
    } else if (status) {
      maquinas = maquinas.filter(m => m.status === status);
    }

    if (modelo) {
      const termo = String(modelo).toLowerCase();
      maquinas = maquinas.filter(m => m.modelo.toLowerCase().includes(termo));
    }

    if (dataInicio) {
      const inicio = new Date(dataInicio);
      maquinas = maquinas.filter(m => new Date(m.dataCadastro) >= inicio);
    }

    if (dataFim) {
      const fim = new Date(dataFim);
      maquinas = maquinas.filter(m => new Date(m.dataCadastro) <= fim);
    }

    return res.json(maquinas);
  });

  // 3. Cadastrar máquina (Upload)
  app.post(
    '/api/maquinas',
    autenticarToken,
    authorizeRoles('ADMIN', 'FUNCIONARIO'),
    (req, res) => {
      upload.single('foto')(req, res, (err) => {
        if (err) {
          return res.status(400).json({ mensagem: err.message });
        }

        const { modelo, numeroSerie, descricao } = req.body;
        if (!modelo || !numeroSerie || !req.file) {
          return res.status(400).json({ mensagem: 'Modelo, número de série e foto são obrigatórios.' });
        }

        const nextId = repository.listMachines().length + 1;
        const maquina = MachineFactory.create({
          id: nextId,
          modelo: modelo.trim(),
          numeroSerie: numeroSerie.trim(),
          descricao: descricao ? descricao.trim() : '',
          fotoUrl: `/uploads/${req.file.filename}`,
          responsavel: req.user
        });

        repository.addMachine(maquina);
        repository.addAuditLog(req.user.id, 'CADASTRO_MAQUINA', `Máquina ${maquina.numeroSerie} enviada.`);

        return res.status(201).json({ mensagem: 'Foto enviada com sucesso!', maquina });
      });
    }
  );

  // 4. Aprovar ou Rejeitar máquina
  app.patch(
    '/api/maquinas/:id/status',
    autenticarToken,
    authorizeRoles('ADMIN'),
    (req, res) => {
      const id = getValidId(req.params.id);
      if (!id) return res.status(400).json({ mensagem: 'ID inválido.' });

      const maquina = repository.findActiveMachine(id);
      if (!maquina) return res.status(404).json({ mensagem: 'Máquina não encontrada.' });

      const { status, motivoRejeicao } = req.body;
      if (!['APROVADO', 'REJEITADO'].includes(status)) {
        return res.status(400).json({ mensagem: 'Status inválido.' });
      }

      maquina.status = status;
      if (status === 'REJEITADO' && motivoRejeicao) {
        maquina.motivoRejeicao = motivoRejeicao;
      }

      repository.addAuditLog(req.user.id, `STATUS_${status}`, `Máquina ${maquina.numeroSerie} marcada como ${status}.`);

      return res.json({ mensagem: `Status atualizado para ${status}.`, maquina });
    }
  );

  // 5. Exclusão lógica
  app.delete(
    '/api/maquinas/:id',
    autenticarToken,
    authorizeRoles('ADMIN'),
    (req, res) => {
      const id = getValidId(req.params.id);
      if (!id) return res.status(400).json({ mensagem: 'ID inválido.' });

      const maquina = repository.findActiveMachine(id);
      if (!maquina) return res.status(404).json({ mensagem: 'Máquina não encontrada.' });

      maquina.isDeleted = true;
      maquina.deletedAt = new Date().toISOString();

      repository.addAuditLog(req.user.id, 'EXCLUSAO_LOGICA', `Máquina ${maquina.numeroSerie} excluída.`);

      return res.json({ mensagem: 'Máquina removida com sucesso.' });
    }
  );

  // 6. Relatório gerencial
  app.get(
    '/api/relatorios/gerencial',
    autenticarToken,
    authorizeRoles('ADMIN'),
    (_req, res) => {
      return res.json(repository.getManagementReport());
    }
  );

  return app;
}

module.exports = { createApp };
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'nocelli_secret_key_2026';

// Configuração de diretório para upload de fotos
const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Middlewares Globais
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(UPLOADS_DIR));
app.use(express.static(path.join(__dirname, 'public')));

// ==========================================
// BANCO DE DADOS EM MEMÓRIA (MOCK DA DAL)
// ==========================================

const users = [
  {
    id: 1,
    nome: 'Administrador Nocelli',
    email: 'admin@nocelli.com.br',
    senhaHash: bcrypt.hashSync('admin123', 8),
    role: 'ADMIN' // ADMIN, FUNCIONARIO, CLIENTE
  },
  {
    id: 2,
    nome: 'João Funcionário',
    email: 'joao@nocelli.com.br',
    senhaHash: bcrypt.hashSync('func123', 8),
    role: 'FUNCIONARIO'
  },
  {
    id: 3,
    nome: 'Cliente Exemplo',
    email: 'cliente@empresa.com',
    senhaHash: bcrypt.hashSync('cliente123', 8),
    role: 'CLIENTE'
  }
];

const maquinas = [];
const auditLogs = [];

// Helper de Log de Auditoria
function registrarAuditoria(usuarioId, acao, detalhe) {
  auditLogs.push({
    id: auditLogs.length + 1,
    usuarioId,
    acao,
    detalhe,
    dataHora: new Date().toISOString()
  });
}

// ==========================================
// CONFIGURAÇÃO DO MULTER (REGRAS DA BLL)
// Validação de formato (.jpg, .jpeg, .png, .gif) e tamanho (até 5MB)
// ==========================================

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `maquina-${uniqueSuffix}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  const meusFormatosPermitidos = ['.jpg', '.jpeg', '.png', '.gif'];
  const ext = path.extname(file.originalname).toLowerCase();
  
  if (meusFormatosPermitidos.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Formato de arquivo inválido. Apenas .jpg, .jpeg, .png e .gif são permitidos.'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // Limite de 5MB
});

// ==========================================
// MIDDLEWARES DE AUTENTICAÇÃO E PERMISSÃO
// ==========================================

function autenticarToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ mensagem: 'Acesso negado. Token não fornecido.' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ mensagem: 'Token inválido ou expirado.' });
    }
    req.user = user;
    next();
  });
}

function autorizarRoles(...rolesPermitidas) {
  return (req, res, next) => {
    if (!rolesPermitidas.includes(req.user.role)) {
      return res.status(403).json({ mensagem: 'Acesso não autorizado para o seu perfil.' });
    }
    next();
  };
}

// ==========================================
// ROTAS DE AUTENTICAÇÃO (/api/auth)
// ==========================================

app.post('/api/auth/login', (req, res) => {
  const { email, senha } = req.body;

  const user = users.find(u => u.email === email);
  if (!user) {
    return res.status(400).json({ mensagem: 'Credenciais inválidas.' });
  }

  const senhaValida = bcrypt.compareSync(senha, user.senhaHash);
  if (!senhaValida) {
    return res.status(400).json({ mensagem: 'Credenciais inválidas.' });
  }

  const token = jwt.sign(
    { id: user.id, nome: user.nome, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: '8h' }
  );

  res.json({
    token,
    usuario: {
      id: user.id,
      nome: user.nome,
      email: user.email,
      role: user.role
    }
  });
});

// ==========================================
// ROTAS DE MÁQUINAS E FOTOS (/api/maquinas)
// ==========================================

// 1. Cadastrar máquina com Upload de Foto (Funcionário e Admin)
app.post(
  '/api/maquinas',
  autenticarToken,
  autorizarRoles('ADMIN', 'FUNCIONARIO'),
  upload.single('foto'),
  (req, res) => {
    try {
      const { modelo, numeroSerie, descricao } = req.body;

      if (!modelo || !numeroSerie) {
        return res.status(400).json({ mensagem: 'Modelo e Número de Série são obrigatórios.' });
      }

      if (!req.file) {
        return res.status(400).json({ mensagem: 'A foto da máquina é obrigatória.' });
      }

      const novaMaquina = {
        id: maquinas.length + 1,
        modelo,
        numeroSerie,
        descricao: descricao || '',
        fotoUrl: `/uploads/${req.file.filename}`,
        status: 'PENDENTE', // PENDENTE, APROVADO, REJEITADO
        responsavelUploadId: req.user.id,
        responsavelUploadNome: req.user.nome,
        dataCadastro: new Date().toISOString(),
        isDeleted: false,
        deletedAt: null
      };

      maquinas.push(novaMaquina);

      registrarAuditoria(
        req.user.id,
        'CADASTRO_MAQUINA',
        `Máquina ${modelo} (Série: ${numeroSerie}) cadastrada com foto.`
      );

      res.status(201).json({
        mensagem: 'Máquina enviada com sucesso! Aguardando aprovação do administrador.',
        maquina: novaMaquina
      });
    } catch (err) {
      res.status(500).json({ mensagem: 'Erro interno no processamento do upload.', erro: err.message });
    }
  }
);

// 2. Listagem e Filtragem Avançada (Admin, Funcionário e Cliente)
app.get('/api/maquinas', autenticarToken, (req, res) => {
  const { modelo, numeroSerie, status, dataInicio, dataFim } = req.query;

  let resultado = maquinas.filter(m => !m.isDeleted);

  // Clientes só enxergam máquinas aprovadas
  if (req.user.role === 'CLIENTE') {
    resultado = resultado.filter(m => m.status === 'APROVADO');
  } else if (status) {
    resultado = resultado.filter(m => m.status.toUpperCase() === status.toUpperCase());
  }

  if (modelo) {
    resultado = resultado.filter(m => m.modelo.toLowerCase().includes(modelo.toLowerCase()));
  }

  if (numeroSerie) {
    resultado = resultado.filter(m => m.numeroSerie.toLowerCase().includes(numeroSerie.toLowerCase()));
  }

  if (dataInicio) {
    resultado = resultado.filter(m => new Date(m.dataCadastro) >= new Date(dataInicio));
  }

  if (dataFim) {
    resultado = resultado.filter(m => new Date(m.dataCadastro) <= new Date(dataFim));
  }

  res.json(resultado);
});

// 3. Obter Detalhes de uma Máquina por ID
app.get('/api/maquinas/:id', autenticarToken, (req, res) => {
  const id = parseInt(req.params.id);
  const maquina = maquinas.find(m => m.id === id && !m.isDeleted);

  if (!maquina) {
    return res.status(404).json({ mensagem: 'Máquina não encontrada.' });
  }

  if (req.user.role === 'CLIENTE' && maquina.status !== 'APROVADO') {
    return res.status(403).json({ mensagem: 'Acesso não permitido.' });
  }

  res.json(maquina);
});

// 4. Painel Gerencial: Aprovar ou Rejeitar Fotos (Apenas Admin)
app.patch(
  '/api/maquinas/:id/status',
  autenticarToken,
  autorizarRoles('ADMIN'),
  (req, res) => {
    const id = parseInt(req.params.id);
    const { status, motivoRejeicao } = req.body;

    if (!['APROVADO', 'REJEITADO'].includes(status)) {
      return res.status(400).json({ mensagem: 'Status inválido. Use APROVADO ou REJEITADO.' });
    }

    const maquina = maquinas.find(m => m.id === id && !m.isDeleted);
    if (!maquina) {
      return res.status(404).json({ mensagem: 'Máquina não encontrada.' });
    }

    maquina.status = status;
    if (status === 'REJEITADO' && motivoRejeicao) {
      maquina.motivoRejeicao = motivoRejeicao;
    }

    registrarAuditoria(
      req.user.id,
      `ALTERACAO_STATUS_${status}`,
      `Status da máquina ID ${id} alterado para ${status}.`
    );

    res.json({
      mensagem: `Status da foto alterado para ${status} com sucesso.`,
      maquina
    });
  }
);

// 5. Exclusão Lógica / Soft Delete (Apenas Admin)
app.delete(
  '/api/maquinas/:id',
  autenticarToken,
  autorizarRoles('ADMIN'),
  (req, res) => {
    const id = parseInt(req.params.id);
    const maquina = maquinas.find(m => m.id === id && !m.isDeleted);

    if (!maquina) {
      return res.status(404).json({ mensagem: 'Máquina não encontrada.' });
    }

    maquina.isDeleted = true;
    maquina.deletedAt = new Date().toISOString();

    registrarAuditoria(
      req.user.id,
      'SOFT_DELETE_MAQUINA',
      `Exclusão lógica realizada para a máquina ID ${id}.`
    );

    res.json({ mensagem: 'Máquina removida com sucesso (exclusão lógica).' });
  }
);

// ==========================================
// ROTAS DE RELATÓRIOS E AUDITORIA (/api/relatorios)
// ==========================================

// Relatório gerencial de volume e produtividade (Admin)
app.get(
  '/api/relatorios/gerencial',
  autenticarToken,
  autorizarRoles('ADMIN'),
  (req, res) => {
    const ativas = maquinas.filter(m => !m.isDeleted);

    const relatorio = {
      totalCadastros: ativas.length,
      pendentes: ativas.filter(m => m.status === 'PENDENTE').length,
      aprovados: ativas.filter(m => m.status === 'APROVADO').length,
      rejeitados: ativas.filter(m => m.status === 'REJEITADO').length,
      excluidasLogicamente: maquinas.filter(m => m.isDeleted).length
    };

    res.json(relatorio);
  }
);

// Logs de auditoria (Admin)
app.get(
  '/api/auditoria',
  autenticarToken,
  autorizarRoles('ADMIN'),
  (req, res) => {
    res.json(auditLogs);
  }
);

// Trata erros de upload de arquivo (limite de tamanho excedido, etc.)
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ mensagem: 'O arquivo excede o limite máximo permitido de 5MB.' });
    }
    return res.status(400).json({ mensagem: err.message });
  } else if (err) {
    return res.status(400).json({ mensagem: err.message });
  }
  next();
});

// Inicialização do Servidor
app.listen(PORT, () => {
  console.log(`[Nocelli Backend] Servidor rodando na porta ${PORT}`);
});
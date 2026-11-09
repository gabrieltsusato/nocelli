const API_URL = 'http://localhost:3000/api';

// Helper para obter o token armazenado
function getToken() {
  return localStorage.getItem('nocelli_token');
}

// 1. Autenticação (Login)
async function login(email, senha) {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email, senha })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.mensagem || 'Erro ao realizar login.');
  }

  // Guarda o Token e os dados do utilizador no localStorage
  localStorage.setItem('nocelli_token', data.token);
  localStorage.setItem('nocelli_user', JSON.stringify(data.usuario));

  return data;
}

// 2. Upload de Máquina com Foto (multipart/form-data)
async function cadastrarMaquina(modelo, numeroSerie, descricao, ficheiroImagem) {
  const formData = new FormData();
  formData.append('modelo', modelo);
  formData.append('numeroSerie', numeroSerie);
  formData.append('descricao', descricao);
  formData.append('foto', ficheiroImagem); // O nome 'foto' deve coincidir com o multer no backend

  const response = await fetch(`${API_URL}/maquinas`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${getToken()}`
      // Nota: Não defina 'Content-Type' manualmente ao enviar FormData; o browser define o boundary automaticamente.
    },
    body: formData
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.mensagem);
  return data;
}

// 3. Listar Máquinas (com filtros opcionais)
async function listarMaquinas(filtros = {}) {
  const params = new URLSearchParams(filtros).toString();
  const url = `${API_URL}/maquinas${params ? `?${params}` : ''}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${getToken()}`,
      'Content-Type': 'application/json'
    }
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.mensagem);
  return data;
}

// 4. Painel de Aprovação (Apenas Administrador)
async function alterarStatusMaquina(id, status, motivoRejeicao = '') {
  const response = await fetch(`${API_URL}/maquinas/${id}/status`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${getToken()}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ status, motivoRejeicao })
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.mensagem);
  return data;
}

// 5. Encerrar Sessão (Logout)
function logout() {
  localStorage.removeItem('nocelli_token');
  localStorage.removeItem('nocelli_user');
}
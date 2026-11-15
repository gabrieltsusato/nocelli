const API_URL = window.NOCELLI_API_URL || `${window.location.origin}/api`;

async function requestApi(path, options = {}) {
  const headers = new Headers(options.headers || {});
  const token = getToken();

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_URL}${path}`, { ...options, headers });
  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json')
    ? await response.json()
    : null;

  if (!response.ok) {
    const message = data?.mensagem || `Falha na comunicação com o servidor (${response.status}).`;

    if (response.status === 403 && message === 'Token inválido ou expirado.') {
      logout();
      if (!window.location.pathname.endsWith('/login.html')) {
        window.location.replace('login.html');
      }
    }

    throw new Error(message);
  }

  return data;
}

function getToken() {
  return localStorage.getItem('nocelli_token');
}

async function login(email, senha) {
  const data = await requestApi('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, senha })
  });

  if (!data?.token || !data?.usuario) {
    throw new Error('O servidor retornou uma resposta de login inválida.');
  }

  localStorage.setItem('nocelli_token', data.token);
  localStorage.setItem('nocelli_user', JSON.stringify(data.usuario));
  return data;
}

async function cadastrarMaquina(modelo, numeroSerie, descricao, ficheiroImagem) {
  const formData = new FormData();
  formData.append('modelo', modelo);
  formData.append('numeroSerie', numeroSerie);
  formData.append('descricao', descricao);
  formData.append('foto', ficheiroImagem);

  return requestApi('/maquinas', {
    method: 'POST',
    body: formData
  });
}

async function listarMaquinas(filtros = {}) {
  const params = new URLSearchParams(
    Object.entries(filtros).filter(([, value]) => value !== undefined && value !== '')
  );
  const query = params.toString();
  return requestApi(`/maquinas${query ? `?${query}` : ''}`);
}

async function alterarStatusMaquina(id, status, motivoRejeicao = '') {
  return requestApi(`/maquinas/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, motivoRejeicao })
  });
}

function logout() {
  localStorage.removeItem('nocelli_token');
  localStorage.removeItem('nocelli_user');
}

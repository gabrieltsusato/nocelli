const bcrypt = require('bcryptjs');

const constructorKey = Symbol('InMemoryRepository');

class InMemoryRepository {
  static #instance;

  static getInstance() {
    if (!InMemoryRepository.#instance) {
      InMemoryRepository.#instance = new InMemoryRepository(constructorKey);
    }

    return InMemoryRepository.#instance;
  }

  constructor(key) {
    if (key !== constructorKey) {
      throw new Error('Use InMemoryRepository.getInstance() para obter o repositório.');
    }

    this.reset();
  }

  reset() {
    this.users = [
      {
        id: 1,
        nome: 'Administrador Nocelli',
        email: 'admin@nocelli.com.br',
        senhaHash: bcrypt.hashSync('admin123', 8),
        role: 'ADMIN'
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
    this.maquinas = [];
    this.auditLogs = [];
  }

  getUserByEmail(email) {
    return this.users.find(user => user.email === email);
  }

  listMachines() {
    return this.maquinas;
  }

  addMachine(machine) {
    this.maquinas.push(machine);
    return machine;
  }

  findActiveMachine(id) {
    return this.maquinas.find(machine => machine.id === id && !machine.isDeleted);
  }

  addAuditLog(usuarioId, acao, detalhe) {
    const log = {
      id: this.auditLogs.length + 1,
      usuarioId,
      acao,
      detalhe,
      dataHora: new Date().toISOString()
    };
    this.auditLogs.push(log);
    return log;
  }

  getAuditLogs() {
    return this.auditLogs;
  }

  getManagementReport() {
    const ativas = this.maquinas.filter(machine => !machine.isDeleted);

    return {
      totalCadastros: ativas.length,
      pendentes: ativas.filter(machine => machine.status === 'PENDENTE').length,
      aprovados: ativas.filter(machine => machine.status === 'APROVADO').length,
      rejeitados: ativas.filter(machine => machine.status === 'REJEITADO').length,
      excluidasLogicamente: this.maquinas.filter(machine => machine.isDeleted).length
    };
  }
}

module.exports = { InMemoryRepository };

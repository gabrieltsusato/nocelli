class MachineFactory {
  static create({ id, modelo, numeroSerie, descricao, fotoUrl, responsavel }) {
    return {
      id,
      modelo,
      numeroSerie,
      descricao: descricao || '',
      fotoUrl,
      status: 'PENDENTE',
      responsavelUploadId: responsavel.id,
      responsavelUploadNome: responsavel.nome,
      dataCadastro: new Date().toISOString(),
      isDeleted: false,
      deletedAt: null
    };
  }
}

module.exports = { MachineFactory };

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

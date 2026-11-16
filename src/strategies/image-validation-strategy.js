const path = require('path');

class ImageValidationStrategy {
  validate(file) {
    throw new Error('A estratégia de validação deve implementar validate(file).');
  }
}

class AllowedImageTypesStrategy extends ImageValidationStrategy {
  constructor(allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif']) {
    super();
    this.allowedExtensions = new Set(allowedExtensions);
  }

  validate(file) {
    if (!file || typeof file.originalname !== 'string') {
      return 'Arquivo inválido.';
    }

    const extension = path.extname(file.originalname).toLowerCase();
    if (!this.allowedExtensions.has(extension)) {
      return 'Formato de arquivo inválido. Apenas .jpg, .jpeg, .png e .gif são permitidos.';
    }

    return null;
  }
}

module.exports = { ImageValidationStrategy, AllowedImageTypesStrategy };

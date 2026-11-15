const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

const outputDirectory = path.join(__dirname, '..', 'docs');
const outputPath = path.join(outputDirectory, 'relatorio-tecnico.pdf');

fs.mkdirSync(outputDirectory, { recursive: true });

const document = new PDFDocument({ size: 'A4', margin: 52, info: {
  Title: 'Relatório técnico — Nocelli Media Hub',
  Author: 'Equipe Nocelli'
} });
document.pipe(fs.createWriteStream(outputPath));

function heading(text) {
  document.moveDown(0.65).font('Helvetica-Bold').fontSize(14).fillColor('#163b5c').text(text);
  document.moveDown(0.2);
}

function paragraph(text) {
  document.font('Helvetica').fontSize(10.5).fillColor('#202a35').text(text, { lineGap: 3 });
  document.moveDown(0.35);
}

function pattern(title, location, explanation) {
  document.font('Helvetica-Bold').fontSize(11).fillColor('#163b5c').text(title);
  document.font('Helvetica').fontSize(10).fillColor('#202a35')
    .text(`Onde: ${location}`, { indent: 10, lineGap: 2 });
  document.text(`Por que: ${explanation}`, { indent: 10, lineGap: 2 });
  document.moveDown(0.45);
}

document.font('Helvetica-Bold').fontSize(21).fillColor('#12324a')
  .text('Relatório técnico');
document.moveDown(0.2).font('Helvetica').fontSize(12).fillColor('#526476')
  .text('Protótipo Nocelli — Gestão de imagens de máquinas');
document.moveDown(0.3).fontSize(9).text('Node.js • Express • padrões GoF • testes automatizados');

heading('1. Visão geral');
paragraph(
  'O protótipo oferece uma API REST para autenticação por perfil, envio de fotos de máquinas, ' +
  'aprovação/rejeição por administrador, consulta filtrada, exclusão lógica, auditoria e relatório gerencial. ' +
  'A interface web existente consome os mesmos endpoints.'
);
paragraph(
  'As camadas se comunicam pelo módulo src/app.js: rotas HTTP usam middleware de autenticação, ' +
  'o repositório mantém os dados em memória e a Factory cria os objetos de domínio. ' +
  'A validação do arquivo é delegada a uma estratégia configurável.'
);

heading('2. Padrões GoF aplicados');
pattern(
  'Singleton — InMemoryRepository',
  'src/repositories/in-memory-repository.js; acessado por src/app.js',
  'Fornece uma instância única do repositório em memória, compartilhada entre requisições. ' +
  'Isso mantém máquinas, usuários e auditoria consistentes durante a execução do protótipo.'
);
pattern(
  'Factory — MachineFactory',
  'src/factories/machine-factory.js; utilizada na rota POST /api/maquinas',
  'Centraliza a criação da entidade Máquina e seus valores iniciais (status PENDENTE, datas, ' +
  'responsável e estado de exclusão), evitando objetos inconsistentes espalhados pelas rotas.'
);
pattern(
  'Strategy — AllowedImageTypesStrategy',
  'src/strategies/image-validation-strategy.js; injetada no filtro do Multer em src/app.js',
  'Encapsula a regra de validação das extensões de imagem. Uma estratégia alternativa pode ser ' +
  'introduzida sem misturar a regra de formato ao armazenamento do arquivo ou aos endpoints.'
);

heading('3. Testes e evidências');
paragraph(
  'A suíte utiliza node:test e cobre autenticação, autorização por perfil, validação de arquivo, ' +
  'upload e aprovação, visibilidade para Cliente, filtros, exclusão lógica e relatório. ' +
  'O roteiro reproduzível está em docs/plano-de-testes.md e a saída da execução está em ' +
  'docs/evidencia-testes.txt.'
);
paragraph(
  'Execução: npm test. Os testes iniciam a aplicação em uma porta efêmera e utilizam um diretório ' +
  'temporário para uploads, sem depender de um servidor já iniciado.'
);

heading('4. Limitação conhecida');
paragraph(
  'O repositório atual é em memória: registros e auditoria são perdidos ao reiniciar o processo. ' +
  'O Singleton é adequado para demonstrar o padrão neste protótipo, mas deve ser substituído por ' +
  'persistência real antes de uso operacional.'
);

document.end();

document.on('end', () => {
  console.log(`Relatório PDF gerado: ${outputPath}`);
});

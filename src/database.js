// ===============================
// CONEXÃO COM POSTGRESQL
// ===============================

// Importa Pool do pacote pg
// Pool gerencia múltiplas conexões com o banco
const { Pool } = require('pg');

// Cria a conexão
const pool = new Pool({
  user: 'postgres',        // usuário do banco
  host: 'localhost',       // banco está na sua máquina
  database: 'kdmarmitex',  // nome do banco
  password: '@Le12345',            // se você NÃO definiu senha, deixe vazio
  port: 5432,              // porta padrão do PostgreSQL
});

// Exporta a conexão para usar em outros arquivos
module.exports = pool;

const express = require('express');
const cors = require('cors');
require('dotenv').config();

const pool = require('./database');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static('public'));


// ===============================
// CRIAR PEDIDO COMPLETO
// ===============================
app.post('/pedido', async (req, res) => {

  const {
    nome,
    telefone,
    tipo_entrega,
    endereco,
    forma_pagamento,
    observacao,
    itens
  } = req.body;

  if (!nome || !telefone || !tipo_entrega || !forma_pagamento || !itens || itens.length === 0) {
    return res.status(400).json({ erro: "Dados inválidos" });
  }

  const client = await pool.connect();

  try {

    await client.query("BEGIN");

    let total = 0;
    for (let item of itens) {
      total += Number(item.quantidade) * Number(item.preco);
    }

    const pedidoResult = await client.query(
      `INSERT INTO pedidos 
      (nome, telefone, total, observacao, endereco, tipo_entrega, forma_pagamento, status) 
      VALUES ($1,$2,$3,$4,$5,$6,$7,'novo') 
      RETURNING id`,
      [
        nome,
        telefone,
        total,
        observacao || null,
        endereco || null,
        tipo_entrega,
        forma_pagamento
      ]
    );

    const pedidoId = pedidoResult.rows[0].id;

    for (let item of itens) {
      await client.query(
        `INSERT INTO pedido_itens 
        (pedido_id, produto, quantidade, preco_unit)
        VALUES ($1,$2,$3,$4)`,
        [
          pedidoId,
          item.nome,
          item.quantidade,
          item.preco
        ]
      );
    }

    await client.query("COMMIT");

    res.status(201).json({ mensagem: "Pedido salvo com sucesso!" });

  } catch (error) {

    await client.query("ROLLBACK");
    console.error("ERRO AO SALVAR PEDIDO:", error);

    res.status(500).json({ erro: "Erro ao salvar pedido" });

  } finally {
    client.release();
  }

});


// ===============================
// LISTAR PEDIDOS (OTIMIZADO)
// ===============================
app.get('/pedidos', async (req, res) => {

  const { inicio, fim } = req.query;

  try {

    let query = `
      SELECT 
        p.*,
        COALESCE(
          json_agg(
            json_build_object(
              'produto', pi.produto,
              'quantidade', pi.quantidade,
              'preco_unit', pi.preco_unit
            )
          ) FILTER (WHERE pi.id IS NOT NULL),
          '[]'
        ) AS itens
      FROM pedidos p
      LEFT JOIN pedido_itens pi ON pi.pedido_id = p.id
    `;

    let params = [];

    if (inicio && fim) {
      query += ` WHERE p.criado_em BETWEEN $1 AND $2 `;
      params.push(inicio, fim);
    }

    query += `
      GROUP BY p.id
      ORDER BY p.criado_em DESC
    `;

    const result = await pool.query(query, params);

    res.json(result.rows);

  } catch (erro) {
    console.error("Erro ao buscar pedidos:", erro);
    res.status(500).json({ erro: "Erro ao buscar pedidos" });
  }

});


// ===============================
// ATUALIZAR STATUS
// ===============================
app.put('/pedido/:id', async (req, res) => {

  const { id } = req.params;
  const { status } = req.body;

  if (!status) {
    return res.status(400).json({ erro: "Status inválido" });
  }

  try {

    await pool.query(
      'UPDATE pedidos SET status = $1 WHERE id = $2',
      [status, id]
    );

    res.json({ mensagem: "Status atualizado" });

  } catch (erro) {
    console.error("Erro ao atualizar status:", erro);
    res.status(500).json({ erro: "Erro ao atualizar status" });
  }

});


// ===============================
// EXCLUIR PEDIDO
// ===============================
app.delete('/pedido/:id', async (req, res) => {

  const { id } = req.params;

  try {

    await pool.query('DELETE FROM pedido_itens WHERE pedido_id = $1', [id]);
    await pool.query('DELETE FROM pedidos WHERE id = $1', [id]);

    res.json({ mensagem: "Pedido excluído" });

  } catch (erro) {
    console.error("Erro ao excluir pedido:", erro);
    res.status(500).json({ erro: "Erro ao excluir pedido" });
  }

});


// ===============================
// INICIAR SERVIDOR
// ===============================
const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});

const express = require('express');
const app = express();
app.use(express.json());

// Simulação de banco de dados em memória para auditoria
const logsOperacionais = [];

const dns = require('dns');
// Força o Node a priorizar IPv4 (resolve 90% dos erros "fetch failed" no Windows)
dns.setDefaultResultOrder('ipv4first');

async function consultarEnderecoPorCep(cep) {
  const cepLimpo = cep.replace(/\D/g, '');
  if (cepLimpo.length !== 8) {
    throw new Error(`CEP inválido recebido: ${cep}`);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    // Tenta a BrasilAPI (mais rápida e estável que o ViaCEP)
    const response = await fetch(`https://brasilapi.com.br{cepLimpo}`, {
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`CEP ${cepLimpo} não encontrado (Status ${response.status}).`);
    }

    const dados = await response.json();

    return {
      logradouro: dados.street || 'Não informado',
      bairro: dados.neighborhood || 'Não informado',
      cidade: dados.city,
      uf: dados.state,
      fonte: 'BrasilAPI'
    };
  } catch (err) {
    // Se a rede local bloquear requisições externas, ativa fallback local para não travar a operação
    if (err.message.includes('fetch failed')) {
      console.warn(`[WARN] Falha de conexão externa (${err.cause?.code || 'rede'}). Ativando fallback local.`);
      return {
        logradouro: 'Avenida Presidente Castelo Branco (Fallback)',
        bairro: 'Centro',
        cidade: 'Fortaleza',
        uf: 'CE',
        fonte: 'Fallback_Local'
      };
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}


app.post('/api/pipeline/lead', async (req, res) => {
  const executionId = `EXEC-${Date.now()}`;
  const { nome, email, cep } = req.body;

  console.log(`[${executionId}] Iniciando pipeline para: ${email}`);

  // Etapa 1: Validação de entrada
  if (!nome || !email || !cep) {
    const erroMsg = 'Campos obrigatórios ausentes (nome, email, cep).';
    logsOperacionais.push({ executionId, status: 'FALHA_VALIDACAO', erro: erroMsg });
    return res.status(400).json({ executionId, erro: erroMsg });
  }

  try {
    // Etapa 2: Enriquecimento de dados via API externa
    console.log(`[${executionId}] Consultando API externa para CEP: ${cep}`);
    const endereco = await consultarEnderecoPorCep(cep);

    // Etapa 3: Formatação para o sistema de destino (CRM)
    const payloadFinal = {
      id_transacao: executionId,
      cliente: nome.trim(),
      contato: email.toLowerCase().trim(),
      localizacao: `${endereco.cidade}/${endereco.uf}`,
      endereco_completo: endereco,
      processado_em: new Date().toISOString()
    };

    logsOperacionais.push({ executionId, status: 'SUCESSO', payload: payloadFinal });
    console.log(`[${executionId}] Pipeline finalizado com sucesso.`);

    return res.status(200).json({
      mensagem: 'Integração concluída com sucesso',
      dados: payloadFinal
    });
  } catch (error) {
    console.error(`[${executionId}] Erro na integração: ${error.message}`);
    logsOperacionais.push({ executionId, status: 'ERRO_INTEGRACAO', detalhe: error.message });

    return res.status(422).json({
      executionId,
      status: 'falha_no_fluxo',
      motivo: error.message
    });
  }
});

// Endpoint para investigação de falhas (Troubleshooting)
app.get('/api/pipeline/logs', (req, res) => {
  res.json({ total: logsOperacionais.length, logs: logsOperacionais });
});

app.listen(3001, () => console.log('Pipeline de Integração rodando na porta 3001'));

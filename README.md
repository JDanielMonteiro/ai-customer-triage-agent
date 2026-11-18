# 🔗 Webhook Integration & Data Enrichment Pipeline

Microserviço em Node.js projetado para orquestrar integrações entre sistemas: recebe dados brutos via Webhook, valida regras de negócio, enriquece informações consultando APIs externas (ViaCEP) e mantém trilha de auditoria para troubleshooting operacional.

## 🔄 Fluxo Ponta a Ponta (End-to-End)
1. **Ingestão:** Recebe payload JSON via `POST /api/pipeline/lead`.
2. **Validação:** Verifica integridade dos campos obrigatórios antes de acionar serviços externos.
3. **Enriquecimento:** Consulta API externa com controle de *timeout* (5 segundos) para evitar travamento de fila.
4. **Observabilidade:** Gera um `executionId` único para cada transação e expõe rota `/api/pipeline/logs` para investigação rápida de falhas.

## 🧪 Cenários de Troubleshooting Testados
* **Payload Incompleto:** Retorna HTTP `400` imediatamente, economizando requisições externas.
* **CEP Inexistente ou Malformado:** Captura o erro da API externa, registra no log com o `executionId` e retorna HTTP `422` com diagnóstico claro.
* **Timeout de API Externa:** Uso de `AbortController` para interromper chamadas travadas após 5 segundos.

## 🚀 Como Testar
1. Instale as dependências e inicie:
   ```bash
   npm install && npm start
   ```
2. Envie um lead válido:
   ```bash
   curl -X POST http://localhost:3001/api/pipeline/lead \
     -H "Content-Type: application/json" \
     -d '{"nome": "Jose", "email": "jose@exemplo.com", "cep": "60060-440"}'
   ```
3. Consulte os logs de execução:
   ```bash
   curl http://localhost:3001/api/pipeline/logs
   ```

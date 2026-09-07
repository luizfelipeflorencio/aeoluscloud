# Plenus

API para cadastro de câmeras e processamento de eventos com imagem. Câmeras são armazenadas no MongoDB; eventos recebidos pelo Kafka têm suas imagens enviadas ao MinIO e seus metadados gravados no ClickHouse.

## Arquitetura

```text
Cliente
  └─ API principal (Node.js / Express :3000)
       ├─ MongoDB: cadastro de câmeras
       ├─ device-event-api: registro de dispositivos
       └─ Kafka consumer (device-events)
            ├─ MinIO: imagens
            └─ ClickHouse: metadados e consultas
```

O `device-event-api`, fornecido como imagem Docker, publica eventos no tópico Kafka `device-events` para cada dispositivo registrado.

## Pré-requisitos

- Node.js 18 ou superior;
- npm;
- Docker Desktop com Docker Compose.

## Serviços e portas

| Serviço | Endereço externo |
| --- | --- |
| API principal | `http://localhost:3000` |
| API de dispositivos | `http://localhost:3030` |
| MongoDB | `localhost:27018` |
| MinIO API | `http://localhost:9000` |
| MinIO Console | `http://localhost:9001` |
| ClickHouse HTTP | `http://localhost:8124` |
| Kafka | `localhost:9092` |
| Kafbat UI | `http://localhost:8082` |

## Configuração

Crie o arquivo `.env` a partir do exemplo:

```bash
cp .env.example .env
```

No PowerShell:

```powershell
Copy-Item .env.example .env
```

As variáveis efetivamente utilizadas pela API são:

```env
PORT=3000

KAFKA_BROKERS=localhost:9092

MONGO_URI=mongodb://admin:adminpassword@localhost:27018/aeolus_db?authSource=admin
MONGO_USER=admin
MONGO_PASSWORD=adminpassword
MONGO_AUTH_SOURCE=admin

MINIO_ENDPOINT=http://127.0.0.1:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadminpassword
MINIO_BUCKET_NAME=camera-events
```

> Atualmente, a conexão com ClickHouse é definida diretamente em `src/service/clickhouse.service.js`: `http://127.0.0.1:8124`, banco `aeolus_analytics`, usuário `clickhouse_user`, senha `clickhouse_pass` e tabela `camera_events`.

## Executar

Suba os serviços de infraestrutura e o produtor de eventos:

```bash
docker compose up -d
```

Instale as dependências e inicie a API principal em outro terminal:

```bash
npm install
npm run dev
```

A API conecta ao MongoDB e inicia um consumer Kafka do tópico `device-events`. Portanto, MongoDB e Kafka precisam estar disponíveis antes de iniciar a aplicação.

O bucket configurado em `MINIO_BUCKET_NAME` é criado automaticamente na primeira operação de upload ou geração de URL assinada; não é necessário criá-lo manualmente.

## Endpoints da API principal

### Câmeras

| Método | Rota | Descrição |
| --- | --- | --- |
| `POST` | `/api/cameras` | Cria uma câmera e registra seu `cameraId` no serviço de dispositivos. |
| `GET` | `/api/cameras` | Lista as câmeras cadastradas. |
| `GET` | `/api/cameras/:cameraId` | Busca uma câmera pelo identificador. |
| `PUT` | `/api/cameras/:cameraId` | Atualiza `cameraName`, `zona` e `enderecoRTSP`. |
| `DELETE` | `/api/cameras/:cameraId` | Remove o dispositivo externo e a câmera local. |

Criar uma câmera:

```bash
curl -X POST http://localhost:3000/api/cameras \
  -H "Content-Type: application/json" \
  -d '{
    "cameraName": "camera-teste-01",
    "zona": "zona-1",
    "enderecoRTSP": "rtsp://localhost:8554/camera-teste-01"
  }'
```

O corpo exige os campos `cameraName`, `zona` e `enderecoRTSP`. O retorno inclui o `cameraId`, usado nas demais operações.

### Eventos

| Método | Rota | Descrição |
| --- | --- | --- |
| `GET` | `/api/events` | Lista eventos armazenados no ClickHouse. |
| `GET` | `/api/events/:eventId/image` | Retorna uma URL pré-assinada, válida por 5 minutos, para a imagem do evento. |

Parâmetros opcionais de `GET /api/events`:

| Parâmetro | Descrição |
| --- | --- |
| `page` | Página, com padrão `1`. |
| `limit` | Itens por página, entre `1` e `100`; padrão `20`. |
| `cameraId` | Filtra por `device_id`. |
| `eventType` | Filtra por `event_type`. |
| `imageKey` | Filtra por `image_key`. |
| `from` ou `dateFrom` | Data/hora inicial. |
| `to` ou `dateTo` | Data/hora final. |

Exemplos:

```bash
curl "http://localhost:3000/api/events?limit=5"
curl "http://localhost:3000/api/events?cameraId=SEU_CAMERA_ID&page=1&limit=20"
curl "http://localhost:3000/api/events/SEU_EVENT_ID/image"
```

## Fluxo de teste manual

1. Suba o Compose e a API principal.
2. Crie uma câmera em `POST /api/cameras`.
3. O `device-event-api` registra o dispositivo e publica eventos no Kafka.
4. Aguarde alguns segundos e consulte `GET /api/events?limit=5`.
5. Copie um `event_id` retornado e consulte `GET /api/events/:eventId/image`.

Também é possível verificar o produtor em `GET http://localhost:3030/api/health` e acompanhar o tópico `device-events` no Kafbat UI (`http://localhost:8082`, usuário `admin`, senha `123456`).

## Parar o ambiente

```bash
docker compose down
```

Para remover também os volumes persistidos do MongoDB:

```bash
docker compose down -v
```

> `docker compose down -v` remove os dados persistidos do ambiente local.

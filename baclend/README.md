# Plenus

Sistema de captura de eventos de cameras composto por:

- MongoDB: cadastro das cameras.
- MinIO: armazenamento das imagens dos eventos.
- ClickHouse: armazenamento e consulta dos eventos.
- Kafka e Zookeeper: fila de eventos.
- Kafbat UI: monitoramento do Kafka.
- `backend-challenge-01-main`: produtor de eventos e gerador de imagens.
- API principal: cadastro de cameras, consumo dos eventos e consultas.

## Pre-requisitos

Instale:

- WSL 2 com Ubuntu ou outra distribuicao Linux.
- Docker Desktop com integracao habilitada para a distribuicao WSL.
- Node.js 18 ou superior.
- npm.
- Git.

Todos os comandos abaixo foram escritos para Bash no WSL. Os comandos de API tambem podem ser executados no Postman.

## Portas utilizadas

| Servico | URL/porta |
| --- | --- |
| API principal | `http://localhost:3000` |
| API de dispositivos | `http://localhost:3030` |
| MongoDB | `localhost:27017` |
| MinIO API | `http://localhost:9000` |
| MinIO Console | `http://localhost:9001` |
| ClickHouse HTTP | `http://localhost:8123` |
| Kafka externo | `localhost:9092` |
| Kafbat UI | `http://localhost:8080` |

> Use somente o `docker-compose.yml` da raiz. O compose dentro de `backend-challenge-01-main` possui portas diferentes e nao deve ser iniciado junto com o compose da raiz.

## 1. Configurar as variaveis

O arquivo `.env` da raiz deve conter, no minimo:

```env
PORT=3000

MONGO_URI=mongodb://admin:adminpassword@localhost:27017/aeolus_db?authSource=admin
MONGO_USER=admin
MONGO_PASSWORD=adminpassword
MONGO_AUTH_SOURCE=admin

MINIO_ENDPOINT=http://127.0.0.1:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadminpassword
MINIO_BUCKET_NAME=camera-events

CLICKHOUSE_URL=http://127.0.0.1:8123
CLICKHOUSE_DATABASE=aeolus_analytics
CLICKHOUSE_USER=clickhouse_user
CLICKHOUSE_PASSWORD=clickhouse_pass
CLICKHOUSE_TABLE=camera_events
```

O `.env` nao deve ser versionado. Se ele nao existir, crie-o a partir dos valores acima.

## 2. Subir a infraestrutura

Na raiz do repositorio:

```bash
docker compose up -d
```

Confira os containers:

```bash
docker compose ps
```

Todos estes servicos devem estar em execucao:

- `mongodb`
- `minio`
- `clickhouse`
- `clg_zookeeper`
- `clg_kafka`
- `clg_kafbat-ui`

### Testar MongoDB, ClickHouse e Kafka

Teste o ClickHouse:

```bash
curl http://localhost:8124/ping
```

A resposta esperada e `Ok.`.

Teste a conectividade externa do Kafka iniciando o produtor no passo 4. A primeira mensagem enviada confirma que o broker esta acessivel.

O MongoDB sera validado quando a API principal iniciar e exibir `Conectado ao MongoDB`.

## 3. Criar o bucket no MinIO

O bucket precisa existir antes do primeiro evento ser processado.

1. Abra `http://localhost:9001`.
2. Entre com:
   - Usuario: `minioadmin`
   - Senha: `minioadminpassword`
3. Acesse **Buckets** e selecione **Create Bucket**.
4. Crie o bucket com o nome `camera-events`.

Teste visualmente acessando o bucket depois que o primeiro evento for gerado. As imagens serao adicionadas pelo consumidor da API principal.

## 4. Instalar e iniciar o produtor de eventos

Abra um terminal na pasta do produtor:

```bash
cd backend-challenge-01-main
npm install
```

O produtor precisa usar a porta `3030` e o Kafka externo da composicao raiz:

```bash
export PORT=3030
export HOST=localhost
export KAFKA_BROKERS=localhost:9092
export KAFKA_TOPIC=device-events
export MIN_EVENT_INTERVAL=3000
export MAX_EVENT_INTERVAL=10000
npm run dev
```

Deixe esse terminal aberto. Em outro terminal, teste:

```bash
curl http://localhost:3030/api/health
```

A resposta deve conter `status: healthy`.

Teste o Kafka pelo produtor:

```bash
curl http://localhost:3030/api/kafka/topic-info
```

A resposta deve informar o topico `device-events`.

## 5. Instalar e iniciar a API principal

Abra outro terminal na raiz do repositorio:

```bash
cd ..
npm install
npm run dev
```

A API deve iniciar na porta `3000`. Durante a inicializacao, ela tambem conecta o consumidor ao topico Kafka `device-events`.

Verifique se a lista inicial de cameras esta acessivel:

```bash
curl http://localhost:3000/api/cameras
```

A resposta esperada e uma lista JSON, normalmente `[]` em uma instalacao nova.

## 6. Teste completo do fluxo

### 6.1 Criar uma camera

A criacao salva a camera no MongoDB e registra o dispositivo no produtor. O produtor gera o primeiro evento imediatamente e depois continua gerando eventos no intervalo configurado.

```bash
curl -X POST http://localhost:3000/api/cameras \
  -H 'Content-Type: application/json' \
  -d '{
    "cameraName": "camera-teste-01",
    "zona": "zona-1",
    "enderecoRTSP": "rtsp://localhost:8554/camera-teste-01"
  }'
```

A resposta esperada e HTTP `201`, contendo `cameraId`, `cameraName`, `zona` e `enderecoRTSP`.

### 6.2 Listar e consultar a camera

```bash
curl http://localhost:3000/api/cameras
```

Substitua o ID abaixo pelo `cameraId` retornado na criacao:

```bash
cameraId="COLE_O_CAMERA_ID_AQUI"
curl "http://localhost:3000/api/cameras/$cameraId"
```

Confirme tambem que o dispositivo foi registrado no produtor:

```bash
curl http://localhost:3030/api/devices
curl "http://localhost:3030/api/devices/$cameraId/status"
```

### 6.3 Consultar eventos processados

Aguarde a chegada de pelo menos um evento e consulte a API principal:

```bash
curl "http://localhost:3000/api/events?limit=5"
```

A resposta deve conter `items` com campos como `event_id`, `device_id`, `event_timestamp`, `image_key` e `value`.

Esse teste confirma o fluxo:

1. O produtor gera a imagem e publica no Kafka.
2. O consumidor da API principal recebe a mensagem.
3. A imagem e enviada ao MinIO.
4. Os metadados sao gravados no ClickHouse.
5. A API principal retorna o evento.

### 6.4 Obter a imagem do evento

Copie o valor de `event_id` retornado na consulta anterior:

```bash
eventId="COLE_O_EVENT_ID_AQUI"
curl "http://localhost:3000/api/events/$eventId/image"
```

A resposta deve conter uma URL temporaria assinada do MinIO. Abra essa URL no navegador para visualizar a imagem.

### 6.5 Atualizar e remover a camera

```bash
curl -X PUT "http://localhost:3000/api/cameras/$cameraId" \
  -H 'Content-Type: application/json' \
  -d '{
    "cameraName": "camera-teste-01-atualizada",
    "zona": "zona-2",
    "enderecoRTSP": "rtsp://localhost:8554/camera-teste-01"
  }'

curl -X DELETE "http://localhost:3000/api/cameras/$cameraId"
```

Depois da remocao, confirme:

```bash
curl http://localhost:3030/api/devices
curl http://localhost:3000/api/cameras
```

## 7. Monitorar o Kafka

Abra `http://localhost:8081`.

Credenciais:

- Usuario: `admin`
- Senha: `123456`

No Kafbat, localize o cluster `local_cluster` e o topico `device-events`. Depois de criar uma camera, devem aparecer mensagens com o `deviceId` e os dados do evento.

## 8. Testar pelo Postman

O arquivo `backend-challenge-01-main/postman-collection.json` contem a colecao do produtor.

1. Abra o Postman.
2. Importe esse arquivo.
3. Configure `baseUrl` como `http://localhost:3030`.
4. Execute `GET /api/health`.
5. Execute `POST /api/devices` com um `deviceId` de teste.
6. Execute `GET /api/devices` e `GET /api/devices/:deviceId/status`.
7. Execute `DELETE /api/devices/:deviceId` ao terminar.

Para testar a API principal, use as URLs `http://localhost:3000/api/cameras` e `http://localhost:3000/api/events` com os mesmos corpos mostrados neste README.

## Parar os servicos

Pare a API principal e o produtor com `Ctrl+C` nos respectivos terminais. Depois, na raiz:

```bash
docker compose down
```

Para remover tambem os dados persistidos do MongoDB, MinIO e ClickHouse:

```bash
docker compose down -v
```

> O comando `down -v` apaga os volumes e todos os dados locais armazenados nesses servicos.

## Solucao de problemas

### A API principal nao conecta ao MongoDB

Confirme se o container esta ativo e se o `.env` usa a porta `27019`:

```bash
docker compose ps mongodb
```

### O produtor retorna erro de Kafka

Confirme que esta usando `KAFKA_BROKERS=localhost:9092` e que o Kafka da raiz esta ativo:

```bash
docker compose ps kafka zookeeper
```

### A camera retorna HTTP 502

O produtor provavelmente nao esta rodando na porta `3030`. Teste:

```bash
curl http://localhost:3030/api/health
```

### Os eventos aparecem no Kafka, mas nao na API

Confira se:

- a API principal esta em execucao;
- o consumidor conseguiu conectar ao Kafka;
- o bucket `camera-events` existe no MinIO;
- o ClickHouse responde em `http://localhost:8124/ping`.

Verifique os logs do terminal da API principal para identificar falhas de upload ou de insercao no ClickHouse.

### O evento existe, mas a imagem nao abre

Confirme que o bucket no MinIO se chama exatamente `camera-events` e que as credenciais do `.env` correspondem ao container.

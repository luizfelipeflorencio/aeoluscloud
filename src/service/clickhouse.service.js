import axios from 'axios';

const eventIdPadrao = 'generateUUIDv4()';

const obterConfiguracao = () => ({
    url: 'http://127.0.0.1:8124',
    database: 'aeolus_analytics',
    username: 'clickhouse_user',
    password: 'clickhouse_pass',
    table: 'camera_events',
});

const executarQuery = async (query, data = '') => {
    const configuracao = obterConfiguracao();
    const corpo = data || query;
    const parametros = {
        database: configuracao.database,
        user: configuracao.username,
        password: configuracao.password,
    };

    if (data) {
        parametros.query = query;
    }

    await axios.post(configuracao.url, corpo, {
        params: parametros,
        headers: {
            'Content-Type': 'text/plain',
        },
    });
};

const consultarQuery = async (query) => {
    const configuracao = obterConfiguracao();
    const resposta = await axios.post(configuracao.url, `${query}\nFORMAT JSON`, {
        params: {
            database: configuracao.database,
            user: configuracao.username,
            password: configuracao.password,
        },
        headers: {
            'Content-Type': 'text/plain',
        },
    });

    return resposta.data;
};

const buscarImagemEvento = async (eventId) => {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(eventId)) {
        return null;
    }

    const { table } = obterConfiguracao();
    const resultado = await consultarQuery(`
        SELECT event_id, image_key
        FROM ${table}
        WHERE event_id = toUUID(${escaparTexto(eventId)})
        LIMIT 1
    `);

    return resultado.data?.[0] || null;
};

const escaparTexto = (valor) => `'${String(valor).replaceAll("'", "''")}'`;

const adicionarFiltroTexto = (condicoes, campo, valor) => {
    const valorExiste = valor !== undefined && valor !== '';
    if (valorExiste) {
        condicoes.push(`${campo} = ${escaparTexto(valor)}`);
    }
};

const primeiroValor = (...valores) => valores.find((valor) => valor !== undefined && valor !== '');

const listarEventos = async (queryParams = {}) => {
    const { table } = obterConfiguracao();
    await criarTabelaEventos();
    const paginaInformada = Number.parseInt(queryParams.page, 10);
    const limiteInformado = Number.parseInt(queryParams.limit, 10);
    const pagina = paginaInformada > 0 ? paginaInformada : 1;
    const limite = limiteInformado >= 1 && limiteInformado <= 100 ? limiteInformado : 20;
    const offset = (pagina - 1) * limite;
    const condicoes = [];

    adicionarFiltroTexto(condicoes, 'device_id', queryParams.cameraId);
    adicionarFiltroTexto(condicoes, 'event_type', queryParams.eventType);
    adicionarFiltroTexto(condicoes, 'image_key', queryParams.imageKey);

    console.log(condicoes)

    const dataInicial = primeiroValor(queryParams.from, queryParams.dateFrom);
    const dataFinal = primeiroValor(queryParams.to, queryParams.dateTo);

    if (dataInicial) {
        condicoes.push(`event_timestamp >= parseDateTimeBestEffort(${escaparTexto(dataInicial)})`);
    }

    if (dataFinal) {
        condicoes.push(`event_timestamp <= parseDateTimeBestEffort(${escaparTexto(dataFinal)})`);
    }

    const where = condicoes.length ? `WHERE ${condicoes.join(' AND ')}` : '';
    const [resultado, total] = await Promise.all([
        consultarQuery(`SELECT * FROM ${table} ${where} ORDER BY event_timestamp DESC LIMIT ${limite} OFFSET ${offset}`),
        consultarQuery(`SELECT count() AS total FROM ${table} ${where}`),
    ]);
    const totalItens = Number(total.data?.[0]?.total || 0);
    return {
        items: resultado.data || [],
        pagination: {
            page: pagina,
            limit: limite,
            total: totalItens,
            pages: Math.ceil(totalItens / limite),
        },
    };
};

const criarTabelaEventos = async () => {
    const { table } = obterConfiguracao();

    await executarQuery(`
        CREATE TABLE IF NOT EXISTS ${table}
        (
            event_id UUID DEFAULT ${eventIdPadrao},
            device_id String,
            event_timestamp DateTime64(3),
            value Float64,
            event_type String,
            image_key String,
            image_format String,
            image_size UInt64,
            image_position String,
            metadata String,
            background_colors String,
            device_text_crop String,
            dimensions String
        )
        ENGINE = MergeTree
        ORDER BY (device_id, event_timestamp)
    `);
};

const inserirEvento = async (evento, imageKey) => {
    const { table } = obterConfiguracao();

    await criarTabelaEventos();

    const linha = {
        device_id: String(evento.deviceId || ''),
        event_timestamp: new Date(evento.timestamp || Date.now()).toISOString().replace('T', ' ').replace('Z', ''),
        value: Number(evento.value || 0),
        event_type: String(evento.eventType || ''),
        image_key: String(imageKey || ''),
        image_format: String(evento.image?.format || ''),
        image_size: Number(evento.image?.size || 0),
        image_position: String(evento.image?.position || ''),
        metadata: JSON.stringify(evento.metadata || {}),
        background_colors: JSON.stringify(evento.background_colors || {}),
        device_text_crop: JSON.stringify(evento.device_text_crop || {}),
        dimensions: JSON.stringify(evento.image?.dimensions || {}),
    };

    await executarQuery(
        `INSERT INTO ${table} FORMAT JSONEachRow`,
        `${JSON.stringify(linha)}\n`,
    );
};

export { inserirEvento, listarEventos, buscarImagemEvento };
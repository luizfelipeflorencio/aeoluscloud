import axios from 'axios';
import { randomUUID } from 'node:crypto';

const eventIdPadrao = `toUUID(concat(
    substring(hex(MD5(concat(device_id, toString(event_timestamp), image_key))), 1, 8), '-',
    substring(hex(MD5(concat(device_id, toString(event_timestamp), image_key))), 9, 4), '-',
    substring(hex(MD5(concat(device_id, toString(event_timestamp), image_key))), 13, 4), '-',
    substring(hex(MD5(concat(device_id, toString(event_timestamp), image_key))), 17, 4), '-',
    substring(hex(MD5(concat(device_id, toString(event_timestamp), image_key))), 21, 12)
))`;

const obterConfiguracao = () => ({
    url: process.env.CLICKHOUSE_URL || 'http://127.0.0.1:8123',
    database: process.env.CLICKHOUSE_DATABASE || 'aeolus_analytics',
    username: process.env.CLICKHOUSE_USER || 'clickhouse_user',
    password: process.env.CLICKHOUSE_PASSWORD || 'clickhouse_pass',
    table: process.env.CLICKHOUSE_TABLE || 'camera_events',
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
    if (valor !== undefined && valor !== '') {
        condicoes.push(`${campo} = ${escaparTexto(valor)}`);
    }
};

const adicionarFiltroNumero = (condicoes, campo, operador, valor) => {
    if (valor !== undefined && valor !== '' && Number.isFinite(Number(valor))) {
        condicoes.push(`${campo} ${operador} ${Number(valor)}`);
    }
};

const listarEventos = async (filtros = {}) => {
    const { table } = obterConfiguracao();
    await criarTabelaEventos();

    const pagina = Math.max(Number.parseInt(filtros.page, 10) || 1, 1);
    const limite = Math.min(Math.max(Number.parseInt(filtros.limit, 10) || 20, 1), 100);
    const offset = (pagina - 1) * limite;
    const condicoes = [];

    adicionarFiltroTexto(condicoes, 'device_id', filtros.deviceId || filtros.camera || filtros.device_id);
    adicionarFiltroTexto(condicoes, 'event_type', filtros.eventType || filtros.event_type);
    adicionarFiltroTexto(condicoes, 'image_key', filtros.imageKey || filtros.image_key);
    adicionarFiltroTexto(condicoes, 'image_format', filtros.imageFormat || filtros.image_format);
    adicionarFiltroTexto(condicoes, 'image_position', filtros.imagePosition || filtros.image_position);
    adicionarFiltroNumero(condicoes, 'value', '=', filtros.value);
    adicionarFiltroNumero(condicoes, 'value', '>=', filtros.valueMin);
    adicionarFiltroNumero(condicoes, 'value', '<=', filtros.valueMax);
    adicionarFiltroNumero(condicoes, 'image_size', '=', filtros.imageSize || filtros.image_size);

    if (filtros.from || filtros.dateFrom) {
        condicoes.push(`event_timestamp >= parseDateTimeBestEffort(${escaparTexto(filtros.from || filtros.dateFrom)})`);
    }

    if (filtros.to || filtros.dateTo) {
        condicoes.push(`event_timestamp <= parseDateTimeBestEffort(${escaparTexto(filtros.to || filtros.dateTo)})`);
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

    await executarQuery(`
        ALTER TABLE ${table}
        ADD COLUMN IF NOT EXISTS event_id UUID DEFAULT ${eventIdPadrao}
    `);

    await executarQuery(`
        ALTER TABLE ${table}
        MODIFY COLUMN event_id UUID DEFAULT ${eventIdPadrao}
    `);
};

const inserirEvento = async (evento, imageKey) => {
    const { table } = obterConfiguracao();

    await criarTabelaEventos();

    const linha = {
        event_id: randomUUID(),
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
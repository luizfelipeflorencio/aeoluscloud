import { gerarUrlAssinada } from '../service/storage.service.js';
import { buscarImagemEvento, listarEventos } from '../service/clickhouse.service.js';

export const consultarEventos = async (req, res) => {
    try {
        const resultado = await listarEventos(req.query);
        res.status(200).json(resultado);
    } catch (error) {
        res.status(500).json({ message: 'Não foi possível consultar os eventos.', error: error.message });
    }
};

export const consultarImagemEvento = async (req, res) => {
    try {
        const evento = await buscarImagemEvento(req.params.eventId);

        if (!evento) {
            return res.status(404).json({ message: 'Evento ou imagem não encontrado.' });
        }

        const url = await gerarUrlAssinada(evento.image_key);
        return res.status(200).json({ eventId: evento.event_id, url });
    } catch (error) {
        return res.status(500).json({ message: 'Não foi possível gerar a URL da imagem.', error: error.message });
    }
};
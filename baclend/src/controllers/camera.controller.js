import Camera from '../models/camera.model.js';
import { adicionarDispositivo, removerDispositivo } from '../service/processador.service.js';

export const criarCamera = async (req, res) => {
    try {
        const { cameraName, zona, enderecoRTSP } = req.body;

        if (!cameraName || !zona || !enderecoRTSP) {
            return res.status(400).json({ message: 'Campos obrigatórios ausentes: cameraName, zona e enderecoRTSP são necessários.' });
        }

        const existeCamera = await Camera.findOne({ cameraName: cameraName });
        if (existeCamera) {
            return res.status(409).json({ message: 'Câmera já existe.' });
        }

        const camera = new Camera({ cameraName, zona, enderecoRTSP });
        await camera.save();

        try {
            await adicionarDispositivo(camera.cameraId.toString());
        } catch (error) {
            await camera.deleteOne();
            return res.status(502).json({ message: 'Não foi possível registrar a câmera no serviço de dispositivos.' });
        }

        res.status(201).json(camera);
    }
    catch (error) {
        res.status(400).json({ message: error.message });
    }
};

export const listarCameras = async (req, res) => {
    try {
        const cameras = await Camera.find();
        res.status(200).json(cameras);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const buscarCameraId = async (req, res) => {
    try {
        const { cameraId } = req.params;
        const camera = await Camera.findOne({ cameraId });
        if (!camera) {
            return res.status(404).json({ message: 'Câmera não encontrada.' });
        }
        res.status(200).json(camera);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const atualizarCamera = async (req, res) => {
    try {
        const { cameraId } = req.params;
        const { cameraName, zona, enderecoRTSP } = req.body;

        const camera = await Camera.findOne({ cameraId });
        if (!camera) {
            return res.status(404).json({ message: 'Câmera não encontrada.' });
        }

        camera.cameraName = cameraName;
        camera.zona = zona;
        camera.enderecoRTSP = enderecoRTSP;

        await camera.save();
        res.status(200).json(camera);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const deletarCamera = async (req, res) => {
    try {
        const { cameraId } = req.params;
        const camera = await Camera.findOne({ cameraId });
        if (!camera) {
            return res.status(404).json({ message: 'Câmera não encontrada.' });
        }

        try {
            await removerDispositivo(cameraId);
        } catch (error) {
            if (error.response?.status !== 404) {
                return res.status(502).json({ message: 'Não foi possível remover a câmera do serviço de dispositivos.' });
            }
        }

        await camera.deleteOne({ cameraId });
        res.status(200).json({ message: 'Câmera deletada com sucesso.' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
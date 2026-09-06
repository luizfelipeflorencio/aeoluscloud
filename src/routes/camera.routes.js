import express from 'express';
import { criarCamera, listarCameras, buscarCameraId, atualizarCamera, deletarCamera } from '../controllers/camera.controller.js';

const router = express.Router();

router.post('/', criarCamera);
router.get('/', listarCameras);
router.get('/:cameraId', buscarCameraId);
router.put('/:cameraId', atualizarCamera);
router.delete('/:cameraId', deletarCamera);

export default router;
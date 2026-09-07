import express from 'express';
import { consultarEventos, consultarImagemEvento } from '../controllers/event.controller.js';

const router = express.Router();

router.get('/', consultarEventos);
router.get('/:eventId/image', consultarImagemEvento);

export default router;
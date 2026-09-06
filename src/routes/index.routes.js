import cameraRoutes from './camera.routes.js';
import eventRoutes from './event.routes.js';
import express from 'express';

const router = express.Router();

router.use('/cameras', cameraRoutes);
router.use('/events', eventRoutes);

export default router;
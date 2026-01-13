import express from 'express';
import apiRoutes from './api';

const router = express.Router();

// 将所有现有的 API 路由作为编舞系统专用路由
router.use('/v1', apiRoutes);

export default router;

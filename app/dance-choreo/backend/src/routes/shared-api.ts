import express, { Request, Response } from 'express';
import os from 'os';

const router = express.Router();

// 获取本地 IP - 这是一个可以在多个系统中共享的通用功能
router.get('/v1/network/local-ip', (req: Request, res: Response) => {
  try {
    const interfaces = os.networkInterfaces();
    const addresses: string[] = [];
    
    Object.keys(interfaces).forEach((ifname) => {
      interfaces[ifname]?.forEach((iface) => {
        // 跳过内部（即 127.0.0.1）和非 IPv4 地址
        if ('IPv4' !== iface.family || iface.internal) {
          return;
        }
        addresses.push(iface.address);
      });
    });

    // 默认返回第一个找到的 IP，或者空字符串
    const localIp = addresses.length > 0 ? addresses[0] : '';
    
    res.json({ success: true, data: { ip: localIp, all: addresses } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;

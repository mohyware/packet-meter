import express, { Request, Response, NextFunction } from 'express';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const PORT = process.env.PACKETPILOT_SERVER_PORT ? parseInt(process.env.PACKETPILOT_SERVER_PORT, 10) : 8080;
const API_KEY = process.env.PACKETPILOT_API_KEY || 'your-api-key-here';

const app = express();

app.use(express.json({ limit: '10mb' }));
app.use(morgan('dev'));

// Simple bearer auth middleware
function auth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.header('Authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : '';
  if (!token || token !== API_KEY) {
    return res.status(401).json({ success: false, message: 'unauthorized' });
  }
  next();
}

const interfaceUsageSchema = z.object({
  Interface: z.string(),
  TotalRx: z.number().nonnegative(),
  TotalTx: z.number().nonnegative(),
  TotalRxMB: z.number().nonnegative(),
  TotalTxMB: z.number().nonnegative(),
});

const dailyUsageReportSchema = z.object({
  DeviceId: z.string(),
  Timestamp: z.string(),
  Date: z.string(), // YYYY-MM-DD
  Interfaces: z.array(interfaceUsageSchema),
  TotalRxMB: z.number().nonnegative(),
  TotalTxMB: z.number().nonnegative(),
});

app.post('/api/v1/traffic/report', auth, (req: Request, res: Response) => {
  const parse = dailyUsageReportSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ success: false, message: 'invalid payload', error: parse.error.flatten() });
  }

  const report = parse.data;
  console.log(`[${new Date().toISOString()}] Daily usage report from device ${report.DeviceId}:`);
  console.log(`  Date: ${report.Date}`);
  console.log(`  Total Combined: ${(report.TotalRxMB + report.TotalTxMB).toFixed(2)} MB (RX: ${report.TotalRxMB.toFixed(2)} MB, TX: ${report.TotalTxMB.toFixed(2)} MB)`);
  console.log(`  Interfaces (${report.Interfaces.length}):`);

  for (const iface of report.Interfaces) {
    const combined = iface.TotalRxMB + iface.TotalTxMB;
    console.log(`    ${iface.Interface}: ${combined.toFixed(2)} MB (RX: ${iface.TotalRxMB.toFixed(2)} MB, TX: ${iface.TotalTxMB.toFixed(2)} MB)`);
  }
  console.log('---');

  return res.json({ success: true, message: 'received', commands: [] });
});

app.get('/health', (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`PacketPilot TS server listening on :${PORT}`);
  console.log(`API Key: ${API_KEY}`);
});

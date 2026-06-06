import express, { Request, Response } from 'express';
import cors from 'cors';
import 'dotenv/config';

import { notFound, errorHandler } from './middleware/errorHandler';

import authRoutes from './routes/authRoutes';
import dispatchRoutes from './routes/dispatchRoutes';
import hospitalRoutes from './routes/hospitalRoutes';
import vitalSignRoutes from './routes/vitalSignRoutes';
import medicalRecordRoutes from './routes/medicalRecordRoutes';
import supplyRoutes from './routes/supplyRoutes';
import reportRoutes from './routes/reportRoutes';
import vehicleRoutes from './routes/vehicleRoutes';

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', (req: Request, res: Response) => {
  res.json({
    status: 'success',
    message: '智慧急救中心院前调度与院内联动系统 API',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      dispatch: '/api/dispatch',
      hospital: '/api/hospitals',
      vitalSigns: '/api/vitals',
      medicalRecords: '/api/medical-records',
      supplies: '/api/supplies',
      reports: '/api/reports',
      vehicles: '/api/vehicles',
    },
  });
});

app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/dispatch', dispatchRoutes);
app.use('/api/hospitals', hospitalRoutes);
app.use('/api/vitals', vitalSignRoutes);
app.use('/api/medical-records', medicalRecordRoutes);
app.use('/api/supplies', supplyRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/vehicles', vehicleRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;

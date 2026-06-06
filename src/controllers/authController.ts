import { Request, Response, NextFunction } from 'express';
import asyncHandler from 'express-async-handler';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../config/prisma';
import { AppError } from '../middleware/errorHandler';
import { UserRole } from '@prisma/client';

const signToken = (id: string, role: UserRole) => {
  return jwt.sign(
    { id, role },
    process.env.JWT_SECRET || 'secret',
    {
      expiresIn: process.env.JWT_EXPIRES_IN || '24h',
    }
  );
};

export const login = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { username, password } = req.body;

    if (!username || !password) {
      return next(new AppError('请提供用户名和密码', 400));
    }

    const user = await prisma.user.findUnique({
      where: { username },
      include: { station: true, team: true, hospital: true },
    });

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return next(new AppError('用户名或密码错误', 401));
    }

    if (!user.isActive) {
      return next(new AppError('账户已被禁用', 401));
    }

    const token = signToken(user.id, user.role);

    res.status(200).json({
      status: 'success',
      token,
      data: {
        user: {
          id: user.id,
          username: user.username,
          fullName: user.fullName,
          role: user.role,
          phone: user.phone,
          email: user.email,
          stationId: user.stationId,
          teamId: user.teamId,
          hospitalId: user.hospitalId,
          department: user.department,
          station: user.station,
          team: user.team,
          hospital: user.hospital,
        },
      },
    });
  }
);

export const register = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { username, password, fullName, role, phone, email, stationId, teamId, hospitalId, department } = req.body;

    if (!username || !password || !fullName || !role) {
      return next(new AppError('请填写必填字段', 400));
    }

    const existingUser = await prisma.user.findUnique({
      where: { username },
    });

    if (existingUser) {
      return next(new AppError('用户名已存在', 400));
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        username,
        passwordHash: hashedPassword,
        fullName,
        role,
        phone,
        email,
        stationId,
        teamId,
        hospitalId,
        department,
      },
    });

    res.status(201).json({
      status: 'success',
      data: {
        user: {
          id: user.id,
          username: user.username,
          fullName: user.fullName,
          role: user.role,
        },
      },
    });
  }
);

export const getCurrentUser = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError('请先登录', 401));
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { station: true, team: true, hospital: true },
    });

    if (!user) {
      return next(new AppError('用户不存在', 404));
    }

    res.status(200).json({
      status: 'success',
      data: {
        user: {
          id: user.id,
          username: user.username,
          fullName: user.fullName,
          role: user.role,
          phone: user.phone,
          email: user.email,
          stationId: user.stationId,
          teamId: user.teamId,
          hospitalId: user.hospitalId,
          department: user.department,
          station: user.station,
          team: user.team,
          hospital: user.hospital,
        },
      },
    });
  }
);

export const listUsers = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { role, stationId, teamId, hospitalId } = req.query;

    const where: any = {};
    if (role) where.role = role;
    if (stationId) where.stationId = stationId as string;
    if (teamId) where.teamId = teamId as string;
    if (hospitalId) where.hospitalId = hospitalId as string;

    const users = await prisma.user.findMany({
      where,
      include: { station: true, team: true, hospital: true },
      orderBy: { createdAt: 'desc' },
    });

    res.status(200).json({
      status: 'success',
      data: {
        users: users.map((u) => ({
          id: u.id,
          username: u.username,
          fullName: u.fullName,
          role: u.role,
          phone: u.phone,
          email: u.email,
          stationId: u.stationId,
          teamId: u.teamId,
          hospitalId: u.hospitalId,
          department: u.department,
          isActive: u.isActive,
          station: u.station,
          team: u.team,
          hospital: u.hospital,
        })),
      },
    });
  }
);

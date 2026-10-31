import { Request, Response, NextFunction } from 'express';

export function verificarAutenticacao(req: Request, res: Response, next: NextFunction): void {
  if (req.session && req.session.logado) {
    next();
  } else {
    res.redirect('/login');
  }
}
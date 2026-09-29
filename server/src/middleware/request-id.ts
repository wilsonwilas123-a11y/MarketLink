import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';

export const REQUEST_ID_HEADER = 'x-request-id';


const FORWARDED_OK = /^[A-Za-z0-9._-]{1,64}$/;

export const requestId: RequestHandler = (req, res, next) => {
  const forwarded = req.header(REQUEST_ID_HEADER);
  const id = forwarded && FORWARDED_OK.test(forwarded) ? forwarded : randomUUID();

  req.requestId = id;
  res.setHeader(REQUEST_ID_HEADER, id);
  next();
};

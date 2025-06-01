import morgan from 'morgan';
import { stream } from '../../utils/logger';

// Define custom tokens
morgan.token('body', (req: any) => JSON.stringify(req.body));
morgan.token('user-id', (req: any) => req.user?.id || 'anonymous');

// Define format
const format = process.env.NODE_ENV === 'production'
  ? ':remote-addr - :user-id [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] - :response-time ms'
  : ':method :url :status :response-time ms - :res[content-length]';

// Create the logger middleware
export const requestLogger = morgan(format, { stream });
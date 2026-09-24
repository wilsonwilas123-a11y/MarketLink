import { setLogMuted } from '../src/lib/logger.js';

// Tests assert on responses and on recorded queries. The error handler's log stream is
// noise here, except where a test spies on the logger deliberately — muting does not
// affect a spy, so those assertions still work.
setLogMuted(true);

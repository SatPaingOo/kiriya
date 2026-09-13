import { createServer } from "node:net";

/** Opens a TCP server on every interface and closes it again; false when the port is taken or not allowed. */
export function canListen(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer();
    server.once("error", () => resolve(false));
    server.listen({ port, exclusive: true }, () => server.close(() => resolve(true)));
  });
}

import net from "node:net";

const TCP_ENABLED =
  (process.env.UTC_TCP_ENABLED ?? "false").toLowerCase() === "true";

const TCP_HOST = process.env.UTC_TCP_HOST ?? "127.0.0.1";
const TCP_PORT = Number(process.env.UTC_TCP_PORT ?? "5000");
const TCP_TIMEOUT_MS = Number(
  process.env.UTC_TCP_TIMEOUT_MS ?? "10000",
);
const MAX_MESSAGE_BYTES = Number(
  process.env.UTC_TCP_MAX_MESSAGE_BYTES ?? "4096",
);

export type TcpMessage = {
  sequence: string;
  xml: string;
};

export type TcpBatchResult = {
  enabled: boolean;
  host: string;
  port: number;
  sentCount: number;
  totalBytes: number;
};

export async function sendRtigBatchOverTcp(
  messages: TcpMessage[],
): Promise<TcpBatchResult> {
  if (!TCP_ENABLED) {
    return {
      enabled: false,
      host: TCP_HOST,
      port: TCP_PORT,
      sentCount: 0,
      totalBytes: 0,
    };
  }

  if (messages.length === 0) {
    throw new Error("No TCP messages were provided");
  }

  const prepared = messages.map((message) => {
    const buffer = Buffer.from(message.xml, "utf8");

    if (buffer.length > MAX_MESSAGE_BYTES) {
      throw new Error(
        `Sequence ${message.sequence} exceeds the ` +
          `${MAX_MESSAGE_BYTES}-byte UTC limit`,
      );
    }

    return {
      ...message,
      buffer,
    };
  });

  return new Promise((resolve, reject) => {
    let settled = false;
    let sentCount = 0;
    let totalBytes = 0;

    const socket = net.createConnection({
      host: TCP_HOST,
      port: TCP_PORT,
    });

    const fail = (error: Error) => {
      if (settled) {
        return;
      }

      settled = true;
      socket.destroy();
      reject(error);
    };

    socket.setTimeout(TCP_TIMEOUT_MS);

    socket.on("connect", async () => {
      try {
        socket.setNoDelay(true);

        for (const message of prepared) {
          await new Promise<void>((resolveWrite, rejectWrite) => {
            socket.write(message.buffer, (error) => {
              if (error) {
                rejectWrite(error);
                return;
              }

              sentCount += 1;
              totalBytes += message.buffer.length;
              resolveWrite();
            });
          });
        }

        socket.end();
      } catch (error) {
        fail(
          error instanceof Error
            ? error
            : new Error("Unknown TCP write error"),
        );
      }
    });

    socket.on("timeout", () => {
      fail(
        new Error(
          `UTC TCP operation timed out after ${TCP_TIMEOUT_MS} ms`,
        ),
      );
    });

    socket.on("error", fail);

    socket.on("close", (hadError) => {
      if (settled || hadError) {
        return;
      }

      settled = true;

      resolve({
        enabled: true,
        host: TCP_HOST,
        port: TCP_PORT,
        sentCount,
        totalBytes,
      });
    });
  });
}
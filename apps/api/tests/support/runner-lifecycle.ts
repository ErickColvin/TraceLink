import type { ChildProcess } from "node:child_process";

export type CleanupTask = Readonly<{
  label: string;
  run: () => void | Promise<void>;
}>;

type CleanupFailure = Readonly<{ label: string; error: unknown }>;

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function labeledCleanupError(failure: CleanupFailure): Error {
  return new Error(`${failure.label}: ${describeError(failure.error)}`, {
    cause: failure.error,
  });
}

export async function runWithCleanup<Result>(
  run: () => Promise<Result>,
  cleanupTasks: readonly CleanupTask[],
): Promise<Result> {
  let outcome:
    | Readonly<{ succeeded: true; value: Result }>
    | Readonly<{ succeeded: false; error: unknown }>;

  try {
    outcome = { succeeded: true, value: await run() };
  } catch (error: unknown) {
    outcome = { succeeded: false, error };
  }

  const cleanupFailures: CleanupFailure[] = [];
  for (const task of cleanupTasks) {
    try {
      await task.run();
    } catch (error: unknown) {
      cleanupFailures.push({ label: task.label, error });
    }
  }

  if (!outcome.succeeded) {
    if (cleanupFailures.length === 0) throw outcome.error;
    throw new AggregateError(
      [outcome.error, ...cleanupFailures.map(labeledCleanupError)],
      `La operación principal falló (${describeError(outcome.error)}) y también falló la limpieza: ${cleanupFailures.map((failure) => `${failure.label}: ${describeError(failure.error)}`).join("; ")}.`,
      { cause: outcome.error },
    );
  }

  if (cleanupFailures.length > 0) {
    throw new AggregateError(
      cleanupFailures.map(labeledCleanupError),
      `Falló la limpieza del runner: ${cleanupFailures.map((failure) => `${failure.label}: ${describeError(failure.error)}`).join("; ")}.`,
    );
  }

  return outcome.value;
}

export function createChildFailurePromise(
  child: ChildProcess,
  label: string,
  diagnostics: () => string = () => "",
): Promise<never> {
  return new Promise<never>((_resolve, reject) => {
    child.once("error", (error) => {
      reject(new Error(`${label} no pudo iniciarse.\n${diagnostics()}`, { cause: error }));
    });
    child.once("exit", (code, signal) => {
      reject(
        new Error(
          `${label} terminó antes de tiempo (${code ?? signal ?? "sin estado"}).\n${diagnostics()}`,
        ),
      );
    });
  });
}

export type ManagedChild = Readonly<{
  isRunning: () => boolean;
  sendSignal: (signal: NodeJS.Signals) => boolean;
  onceError: (listener: (error: Error) => void) => () => void;
  onceExit: (listener: () => void) => () => void;
}>;

export function manageChild(child: ChildProcess): ManagedChild {
  return {
    isRunning: () => child.exitCode === null && child.signalCode === null,
    sendSignal: (signal) => child.kill(signal),
    onceError: (listener) => {
      child.once("error", listener);
      return () => child.off("error", listener);
    },
    onceExit: (listener) => {
      child.once("exit", listener);
      return () => child.off("exit", listener);
    },
  };
}

export async function stopManagedChild(
  child: ManagedChild,
  graceTimeoutMs = 5_000,
  forceTimeoutMs = 5_000,
): Promise<void> {
  if (!child.isRunning()) return;

  await new Promise<void>((resolve, reject) => {
    const timers: {
      grace?: NodeJS.Timeout;
      force?: NodeJS.Timeout;
    } = {};
    let settled = false;
    const removeErrorListener = child.onceError((error) => finish(error));
    const removeExitListener = child.onceExit(() => finish());

    function finish(error?: Error): void {
      if (settled) return;
      settled = true;
      if (timers.grace !== undefined) clearTimeout(timers.grace);
      if (timers.force !== undefined) clearTimeout(timers.force);
      removeErrorListener();
      removeExitListener();
      if (error === undefined) resolve();
      else reject(error);
    }

    function signal(signal: NodeJS.Signals): boolean {
      try {
        const accepted = child.sendSignal(signal);
        if (!accepted && child.isRunning()) {
          finish(new Error(`El proceso hijo rechazó ${signal}.`));
          return false;
        }
        if (!child.isRunning()) finish();
        return true;
      } catch (error: unknown) {
        finish(
          new Error(`No se pudo enviar ${signal} al proceso hijo.`, {
            cause: error,
          }),
        );
        return false;
      }
    }

    if (!signal("SIGTERM") || settled) return;
    timers.grace = setTimeout(() => {
      if (!child.isRunning()) {
        finish();
        return;
      }
      if (!signal("SIGKILL") || settled) return;
      timers.force = setTimeout(() => {
        if (child.isRunning()) {
          finish(new Error("El proceso hijo siguió activo después de SIGKILL."));
        } else {
          finish();
        }
      }, forceTimeoutMs);
    }, graceTimeoutMs);
  });
}

export async function stopChild(
  child: ChildProcess | undefined,
  graceTimeoutMs = 5_000,
  forceTimeoutMs = 5_000,
): Promise<void> {
  if (child === undefined) return;
  await stopManagedChild(manageChild(child), graceTimeoutMs, forceTimeoutMs);
}

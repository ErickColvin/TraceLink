import { spawn } from "node:child_process";

import { describe, expect, it, vi } from "vitest";

import {
  createChildFailurePromise,
  runWithCleanup,
  stopManagedChild,
  type ManagedChild,
} from "../support/runner-lifecycle.js";

function createManagedChild(options: Readonly<{
  initiallyRunning?: boolean;
  onSignal?: (signal: NodeJS.Signals, exit: () => void) => boolean;
}> = {}): Readonly<{ child: ManagedChild; signals: NodeJS.Signals[] }> {
  let running = options.initiallyRunning ?? true;
  const signals: NodeJS.Signals[] = [];
  let errorListener: ((error: Error) => void) | undefined;
  let exitListener: (() => void) | undefined;
  const exit = () => {
    running = false;
    queueMicrotask(() => exitListener?.());
  };

  return {
    signals,
    child: {
      isRunning: () => running,
      sendSignal: (signal) => {
        signals.push(signal);
        return options.onSignal?.(signal, exit) ?? true;
      },
      onceError: (listener) => {
        errorListener = listener;
        return () => {
          if (errorListener === listener) errorListener = undefined;
        };
      },
      onceExit: (listener) => {
        exitListener = listener;
        return () => {
          if (exitListener === listener) exitListener = undefined;
        };
      },
    },
  };
}

describe("runner lifecycle", () => {
  it("fails a successful run when cleanup fails and still runs later tasks", async () => {
    const sequence: string[] = [];

    await expect(
      runWithCleanup(
        async () => "ok",
        [
          { label: "first", run: () => Promise.reject(new Error("cleanup failed")) },
          { label: "second", run: () => { sequence.push("second"); } },
        ],
      ),
    ).rejects.toThrow("Falló la limpieza del runner: first");
    expect(sequence).toEqual(["second"]);
  });

  it("preserves a primary failure while reporting cleanup failures", async () => {
    const primary = new Error("primary failure");
    const laterCleanup = vi.fn();
    let captured: unknown;

    try {
      await runWithCleanup(
        async () => Promise.reject(primary),
        [
          { label: "broken cleanup", run: () => Promise.reject(new Error("cleanup failure")) },
          { label: "later cleanup", run: laterCleanup },
        ],
      );
    } catch (error: unknown) {
      captured = error;
    }

    expect(captured).toBeInstanceOf(AggregateError);
    expect((captured as AggregateError).errors[0]).toBe(primary);
    expect(String(captured)).toContain("primary failure");
    expect(laterCleanup).toHaveBeenCalledOnce();
  });

  it("turns a child spawn error into a rejected lifecycle promise", async () => {
    const child = spawn(`missing-tracelink-command-${crypto.randomUUID()}`);
    await expect(
      createChildFailurePromise(child, "Vite", () => "captured diagnostics"),
    ).rejects.toThrow("Vite no pudo iniciarse");
  });

  it("escalates TERM to KILL and waits for confirmed exit", async () => {
    const managed = createManagedChild({
      onSignal: (signal, exit) => {
        if (signal === "SIGKILL") exit();
        return true;
      },
    });

    await stopManagedChild(managed.child, 1, 20);
    expect(managed.signals).toEqual(["SIGTERM", "SIGKILL"]);
  });

  it("rejects a failed forced termination", async () => {
    const managed = createManagedChild({
      onSignal: (signal) => signal !== "SIGKILL",
    });

    await expect(stopManagedChild(managed.child, 1, 20)).rejects.toThrow(
      "rechazó SIGKILL",
    );
  });

  it("does nothing for an already-exited child", async () => {
    const managed = createManagedChild({ initiallyRunning: false });
    await stopManagedChild(managed.child, 1, 1);
    expect(managed.signals).toEqual([]);
  });
});
